import { create } from 'zustand'
import { nanoid } from 'nanoid'
import {
  createInstance,
  DEVICE_FRAMES,
  emptyFrame,
  type Connector,
  type CustomComponent,
  type DeviceKind,
  type Frame,
  type Layout,
  type NodeInstance,
  type Project,
  type ScreenDoc,
  type Template,
  type TreeNode
} from '@uiux/shared'
import { api } from '../lib/apiClient'
import {
  absoluteOrigin,
  boundingBox,
  cloneWithNewIds,
  deepestContainerAt,
  descendantIds,
  expandDefinition,
  findNode,
  groupIntoDefinition,
  insertChildren,
  removeNodes,
  updateNode
} from './tree'

export type AlignKind = 'left' | 'centerH' | 'right' | 'top' | 'middle' | 'bottom'
export type DistributeKind = 'horizontal' | 'vertical'
export type EditorView = 'edit' | 'board'

/** Draft used by the component editor (a component's definition root). */
export interface ComponentDraft {
  id: string | null // existing component id, or null for a new one
  name: string
}

interface EditorState {
  // workspace
  projectId: string | null
  projectName: string
  tree: TreeNode[]
  components: CustomComponent[]
  templates: Template[]

  // active document + editing context
  doc: ScreenDoc | null
  activeFrameId: string | null
  view: EditorView
  componentDraft: ComponentDraft | null
  /** Working root of the component editor (when componentDraft is set). */
  draftRoot: NodeInstance | null

  // canvas working state (applies to the active surface)
  selection: string[]
  clipboard: { nodes: NodeInstance[] } | null
  zoom: number
  saving: boolean
  dirty: boolean
  notesOpen: boolean
  past: NodeInstance[]
  future: NodeInstance[]

  // collaboration
  collaborators: { id: string; email: string }[]
  remoteCursors: Record<string, { email: string; x: number; y: number }>

  // --- workspace ---
  loadProjects: () => Promise<Project[]>
  openProject: (id: string) => Promise<void>
  createProject: (name: string) => Promise<Project>
  refreshTree: () => Promise<void>
  createNode: (type: 'folder' | 'screen', name: string, parentId: string | null, device?: DeviceKind) => Promise<void>
  renameNode: (nodeId: string, name: string) => Promise<void>
  deleteNode: (nodeId: string) => Promise<void>
  openScreen: (screenId: string) => Promise<void>

  // --- frames / board ---
  setActiveFrame: (frameId: string) => void
  addFrame: (device: DeviceKind) => void
  renameFrame: (frameId: string, name: string) => void
  deleteFrame: (frameId: string) => void
  setFrameDevice: (device: DeviceKind) => void
  moveFrameOnBoard: (frameId: string, x: number, y: number) => void
  setView: (view: EditorView) => void
  addConnector: (from: string, to: string) => void
  updateConnector: (id: string, patch: Partial<Connector>) => void
  deleteConnector: (id: string) => void

  // --- component editor ---
  newComponent: () => void
  editComponent: (componentId: string) => void
  editComponentFromSelection: () => void
  setDraftName: (name: string) => void
  closeComponentEditor: () => void
  saveComponentDraft: () => Promise<void>

  // --- history ---
  checkpoint: () => void
  undo: () => void
  redo: () => void

  // --- canvas actions (operate on the active surface root) ---
  setSelection: (ids: string[]) => void
  toggleSelection: (id: string) => void
  insertPrimitive: (type: string, at: { x: number; y: number }, parentId?: string) => void
  insertDefinition: (def: NodeInstance, at: { x: number; y: number }, parentId?: string) => void
  insertComponentInstance: (componentId: string, at: { x: number; y: number }, parentId?: string) => void
  detachComponentInstance: (id: string) => void
  updateLayout: (id: string, patch: Partial<Layout>) => void
  updateProp: (id: string, key: string, value: unknown) => void
  updateStyle: (id: string, key: string, value: string) => void
  reparent: (id: string, absPoint: { x: number; y: number }) => void
  copy: () => void
  paste: () => void
  duplicate: () => void
  remove: () => void
  align: (kind: AlignKind) => void
  distribute: (kind: DistributeKind) => void

  // --- device / notes / zoom ---
  setZoom: (zoom: number) => void
  setNotes: (notes: string) => void
  toggleNotes: () => void

  // --- library ---
  deleteComponent: (id: string) => Promise<void>
  saveAsTemplate: (name: string) => Promise<void>
  applyTemplate: (template: Template) => void
  deleteTemplate: (id: string) => Promise<void>

  // --- persistence ---
  saveScreen: () => Promise<void>

  // --- internal surface helpers ---
  getRoot: () => NodeInstance | null
  setRoot: (root: NodeInstance) => void

  // --- collaboration ---
  setCollaborators: (c: { id: string; email: string }[]) => void
  applyRemoteRoot: (frameId: string, root: NodeInstance) => void
  setRemoteCursor: (id: string, data: { email: string; x: number; y: number }) => void
  pruneCursors: (presentIds: string[]) => void
}

/** The active frame, if any (and not in the component editor). */
function activeFrame(s: EditorState): Frame | null {
  if (!s.doc || !s.activeFrameId) return null
  return s.doc.frames.find((f) => f.id === s.activeFrameId) ?? null
}

/** Selector: the root currently being edited (component draft or active frame). */
export function selectRoot(s: EditorState): NodeInstance | null {
  if (s.componentDraft) return s.draftRoot
  return activeFrame(s)?.root ?? null
}

/** Selector: the size/device of the active surface for the canvas frame. */
export function selectSurface(s: EditorState): { width: number; height: number; device: DeviceKind } | null {
  if (s.componentDraft && s.draftRoot) {
    return { width: s.draftRoot.layout.w, height: s.draftRoot.layout.h, device: 'pc' }
  }
  const f = activeFrame(s)
  return f ? { width: f.canvas.width, height: f.canvas.height, device: f.device } : null
}

export const useEditor = create<EditorState>((set, get) => ({
  projectId: null,
  projectName: '',
  tree: [],
  components: [],
  templates: [],
  doc: null,
  activeFrameId: null,
  view: 'edit',
  componentDraft: null,
  draftRoot: null,
  selection: [],
  clipboard: null,
  zoom: 1,
  saving: false,
  dirty: false,
  notesOpen: true,
  past: [],
  future: [],
  collaborators: [],
  remoteCursors: {},

  // --- surface helpers ---
  getRoot: () => selectRoot(get()),
  setRoot: (root) => {
    const s = get()
    if (s.componentDraft) {
      set({ draftRoot: root, dirty: true })
    } else if (s.doc && s.activeFrameId) {
      const frames = s.doc.frames.map((f) => (f.id === s.activeFrameId ? { ...f, root } : f))
      set({ doc: { ...s.doc, frames }, dirty: true })
    }
  },

  // --- workspace ---
  loadProjects: async () => api.listProjects(),

  openProject: async (id) => {
    const { project, tree } = await api.getProject(id)
    const [components, templates] = await Promise.all([api.listComponents(id), api.listTemplates(id)])
    set({
      projectId: id,
      projectName: project.name,
      tree,
      components,
      templates,
      doc: null,
      activeFrameId: null,
      componentDraft: null,
      draftRoot: null,
      selection: []
    })
  },

  createProject: async (name) => {
    const project = await api.createProject(name)
    await get().openProject(project.id)
    return project
  },

  refreshTree: async () => {
    const { projectId } = get()
    if (!projectId) return
    set({ tree: await api.listTree(projectId) })
  },

  createNode: async (type, name, parentId, device) => {
    const { projectId } = get()
    if (!projectId) return
    const node = await api.createTreeNode(projectId, { type, name, parentId, device })
    await get().refreshTree()
    if (type === 'screen' && node.screenId) await get().openScreen(node.screenId)
  },

  renameNode: async (nodeId, name) => {
    const { projectId } = get()
    if (!projectId) return
    await api.updateTreeNode(projectId, nodeId, { name })
    await get().refreshTree()
  },

  deleteNode: async (nodeId) => {
    const { projectId, tree, doc } = get()
    if (!projectId) return
    const node = tree.find((n) => n.id === nodeId)
    await api.deleteTreeNode(projectId, nodeId)
    await get().refreshTree()
    if (node?.type === 'screen' && node.screenId === doc?.id) {
      set({ doc: null, activeFrameId: null, selection: [] })
    }
  },

  openScreen: async (screenId) => {
    const { projectId } = get()
    if (!projectId) return
    const doc = await api.getScreen(projectId, screenId)
    set({
      doc,
      activeFrameId: doc.frames[0]?.id ?? null,
      view: 'edit',
      componentDraft: null,
      draftRoot: null,
      selection: [],
      dirty: false,
      past: [],
      future: [],
      remoteCursors: {}
    })
  },

  // --- frames / board ---
  setActiveFrame: (frameId) =>
    set({ activeFrameId: frameId, view: 'edit', selection: [], past: [], future: [] }),

  addFrame: (device) => {
    const { doc } = get()
    if (!doc) return
    const offset = doc.frames.length
    const frame = emptyFrame(nanoid(10), `Screen ${doc.frames.length + 1}`, device, {
      x: 80 + offset * 60,
      y: 80 + offset * 40
    })
    set({ doc: { ...doc, frames: [...doc.frames, frame] }, activeFrameId: frame.id, view: 'edit', dirty: true, selection: [], past: [], future: [] })
  },

  renameFrame: (frameId, name) => {
    const { doc } = get()
    if (!doc) return
    set({ doc: { ...doc, frames: doc.frames.map((f) => (f.id === frameId ? { ...f, name } : f)) }, dirty: true })
  },

  deleteFrame: (frameId) => {
    const { doc, activeFrameId } = get()
    if (!doc || doc.frames.length <= 1) return
    const frames = doc.frames.filter((f) => f.id !== frameId)
    const connectors = doc.connectors.filter((c) => c.from !== frameId && c.to !== frameId)
    const nextActive = activeFrameId === frameId ? frames[0]?.id ?? null : activeFrameId
    set({ doc: { ...doc, frames, connectors }, activeFrameId: nextActive, dirty: true, selection: [] })
  },

  setFrameDevice: (device) => {
    const { doc, activeFrameId } = get()
    if (!doc || !activeFrameId) return
    get().checkpoint()
    const f = DEVICE_FRAMES[device]
    const frames = doc.frames.map((fr) =>
      fr.id === activeFrameId
        ? {
            ...fr,
            device,
            canvas: { width: f.width, height: f.height },
            root: { ...fr.root, layout: { ...fr.root.layout, w: f.width, h: f.height } }
          }
        : fr
    )
    set({ doc: { ...doc, frames }, dirty: true })
  },

  moveFrameOnBoard: (frameId, x, y) => {
    const { doc } = get()
    if (!doc) return
    set({ doc: { ...doc, frames: doc.frames.map((f) => (f.id === frameId ? { ...f, board: { x, y } } : f)) }, dirty: true })
  },

  setView: (view) => set({ view, selection: [] }),

  addConnector: (from, to) => {
    const { doc } = get()
    if (!doc || from === to) return
    if (doc.connectors.some((c) => c.from === from && c.to === to)) return
    set({ doc: { ...doc, connectors: [...doc.connectors, { id: nanoid(8), from, to }] }, dirty: true })
  },

  updateConnector: (id, patch) => {
    const { doc } = get()
    if (!doc) return
    set({ doc: { ...doc, connectors: doc.connectors.map((c) => (c.id === id ? { ...c, ...patch } : c)) }, dirty: true })
  },

  deleteConnector: (id) => {
    const { doc } = get()
    if (!doc) return
    set({ doc: { ...doc, connectors: doc.connectors.filter((c) => c.id !== id) }, dirty: true })
  },

  // --- component editor ---
  newComponent: () => {
    const root: NodeInstance = {
      id: 'root',
      type: 'container',
      props: {},
      style: { background: '#ffffff' },
      layout: { x: 0, y: 0, w: 400, h: 300 },
      children: []
    }
    set({ componentDraft: { id: null, name: '' }, draftRoot: root, selection: [], past: [], future: [] })
  },

  editComponent: (componentId) => {
    const comp = get().components.find((c) => c.id === componentId)
    if (!comp) return
    set({
      componentDraft: { id: comp.id, name: comp.name },
      draftRoot: cloneWithNewIds(comp.definition),
      selection: [],
      past: [],
      future: []
    })
  },

  editComponentFromSelection: () => {
    const root = get().getRoot()
    const { selection } = get()
    if (!root || !selection.length) return
    const items = selection.map((id) => findNode(root, id)?.node).filter(Boolean) as NodeInstance[]
    const def = groupIntoDefinition(items)
    set({ componentDraft: { id: null, name: '' }, draftRoot: def, selection: [], past: [], future: [] })
  },

  setDraftName: (name) => {
    const d = get().componentDraft
    if (d) set({ componentDraft: { ...d, name } })
  },

  closeComponentEditor: () =>
    set({ componentDraft: null, draftRoot: null, selection: [], past: [], future: [] }),

  saveComponentDraft: async () => {
    const { projectId, componentDraft, draftRoot } = get()
    if (!projectId || !componentDraft || !draftRoot) return
    const name = componentDraft.name.trim() || 'Component'
    if (componentDraft.id) {
      const updated = await api.updateComponent(projectId, componentDraft.id, name, draftRoot)
      set((s) => ({ components: s.components.map((c) => (c.id === updated.id ? updated : c)) }))
    } else {
      const created = await api.createComponent(projectId, name, draftRoot)
      set((s) => ({ components: [...s.components, created] }))
    }
    get().closeComponentEditor()
  },

  // --- history ---
  checkpoint: () => {
    const root = get().getRoot()
    const { past } = get()
    if (!root) return
    if (past[past.length - 1] === root) return
    set({ past: [...past, root].slice(-50), future: [] })
  },

  undo: () => {
    const { past, future } = get()
    const root = get().getRoot()
    if (!past.length || !root) return
    const prev = past[past.length - 1]
    get().setRoot(prev)
    set({ past: past.slice(0, -1), future: [root, ...future], selection: [] })
  },

  redo: () => {
    const { past, future } = get()
    const root = get().getRoot()
    if (!future.length || !root) return
    const next = future[0]
    get().setRoot(next)
    set({ future: future.slice(1), past: [...past, root], selection: [] })
  },

  // --- canvas actions ---
  setSelection: (ids) => set({ selection: ids }),
  toggleSelection: (id) =>
    set((s) =>
      s.selection.includes(id)
        ? { selection: s.selection.filter((x) => x !== id) }
        : { selection: [...s.selection, id] }
    ),

  insertPrimitive: (type, at, parentId = 'root') => {
    const root = get().getRoot()
    if (!root) return
    get().checkpoint()
    const inst = createInstance(type, nanoid(10), at)
    get().setRoot(insertChildren(root, parentId, [inst]))
    set({ selection: [inst.id] })
  },

  insertDefinition: (def, at, parentId = 'root') => {
    const root = get().getRoot()
    if (!root) return
    get().checkpoint()
    const instances = expandDefinition(def, at)
    get().setRoot(insertChildren(root, parentId, instances))
    set({ selection: instances.map((i) => i.id) })
  },

  insertComponentInstance: (componentId, at, parentId = 'root') => {
    const root = get().getRoot()
    const comp = get().components.find((c) => c.id === componentId)
    if (!root || !comp) return
    get().checkpoint()
    const inst: NodeInstance = {
      id: nanoid(10),
      type: `custom:${componentId}`,
      props: {},
      style: {},
      layout: { x: at.x, y: at.y, w: comp.definition.layout.w, h: comp.definition.layout.h },
      children: []
    }
    get().setRoot(insertChildren(root, parentId, [inst]))
    set({ selection: [inst.id] })
  },

  detachComponentInstance: (id) => {
    const root = get().getRoot()
    if (!root) return
    const found = findNode(root, id)
    if (!found || !found.node.type.startsWith('custom:')) return
    const comp = get().components.find((c) => c.id === found.node.type.slice('custom:'.length))
    if (!comp) return
    get().checkpoint()
    const sx = found.node.layout.w / (comp.definition.layout.w || 1)
    const sy = found.node.layout.h / (comp.definition.layout.h || 1)
    const parentId = found.parent?.id ?? 'root'
    const expanded = comp.definition.children.map((child) => {
      const clone = cloneWithNewIds(child)
      return {
        ...clone,
        layout: {
          x: Math.round(found.node.layout.x + clone.layout.x * sx),
          y: Math.round(found.node.layout.y + clone.layout.y * sy),
          w: Math.round(clone.layout.w * sx),
          h: Math.round(clone.layout.h * sy)
        }
      }
    })
    let next = removeNodes(root, new Set([id]))
    next = insertChildren(next, parentId, expanded)
    get().setRoot(next)
    set({ selection: expanded.map((e) => e.id) })
  },

  updateLayout: (id, patch) => {
    const root = get().getRoot()
    if (!root) return
    get().setRoot(updateNode(root, id, (n) => ({ ...n, layout: { ...n.layout, ...patch } })))
  },

  updateProp: (id, key, value) => {
    const root = get().getRoot()
    if (!root) return
    get().setRoot(updateNode(root, id, (n) => ({ ...n, props: { ...n.props, [key]: value } })))
  },

  updateStyle: (id, key, value) => {
    const root = get().getRoot()
    if (!root) return
    get().setRoot(updateNode(root, id, (n) => ({ ...n, style: { ...n.style, [key]: value } })))
  },

  reparent: (id, absPoint) => {
    const root = get().getRoot()
    if (!root) return
    const found = findNode(root, id)
    if (!found) return
    const exclude = new Set<string>([id, ...descendantIds(found.node)])
    const target = deepestContainerAt(root, absPoint.x, absPoint.y, exclude)
    const currentParentId = found.parent?.id ?? 'root'
    if (target.id === currentParentId) return
    const abs = absoluteOrigin(root, id)!
    const newLayout = { ...found.node.layout, x: abs.x - target.originX, y: abs.y - target.originY }
    get().checkpoint()
    const detached = { ...found.node, layout: newLayout }
    let next = removeNodes(root, new Set([id]))
    next = insertChildren(next, target.id, [detached])
    get().setRoot(next)
  },

  copy: () => {
    const root = get().getRoot()
    const { selection } = get()
    if (!root || !selection.length) return
    const nodes = selection.map((id) => findNode(root, id)?.node).filter(Boolean) as NodeInstance[]
    if (nodes.length) set({ clipboard: { nodes } })
  },

  paste: () => {
    const root = get().getRoot()
    const { clipboard } = get()
    if (!root || !clipboard?.nodes.length) return
    get().checkpoint()
    const clones = clipboard.nodes.map((c) => {
      const copy = cloneWithNewIds(c)
      return { ...copy, layout: { ...copy.layout, x: copy.layout.x + 24, y: copy.layout.y + 24 } }
    })
    get().setRoot(insertChildren(root, 'root', clones))
    set({ selection: clones.map((c) => c.id) })
  },

  duplicate: () => {
    get().copy()
    get().paste()
  },

  remove: () => {
    const root = get().getRoot()
    const { selection } = get()
    if (!root || !selection.length) return
    get().checkpoint()
    get().setRoot(removeNodes(root, new Set(selection)))
    set({ selection: [] })
  },

  align: (kind) => {
    const root = get().getRoot()
    const { selection } = get()
    if (!root || selection.length < 2) return
    const found = selection.map((id) => findNode(root, id)).filter(Boolean) as { node: NodeInstance; parent: NodeInstance | null }[]
    const parentIds = new Set(found.map((f) => f.parent?.id ?? 'root'))
    if (parentIds.size !== 1) return
    get().checkpoint()
    const items = found.map((f) => f.node)
    const box = boundingBox(items)
    const newLayout = (n: NodeInstance): Partial<Layout> => {
      switch (kind) {
        case 'left':
          return { x: box.x }
        case 'right':
          return { x: box.x + box.w - n.layout.w }
        case 'centerH':
          return { x: box.x + (box.w - n.layout.w) / 2 }
        case 'top':
          return { y: box.y }
        case 'bottom':
          return { y: box.y + box.h - n.layout.h }
        case 'middle':
          return { y: box.y + (box.h - n.layout.h) / 2 }
      }
    }
    let next = root
    for (const n of items) next = updateNode(next, n.id, (x) => ({ ...x, layout: { ...x.layout, ...newLayout(x) } }))
    get().setRoot(next)
  },

  distribute: (kind) => {
    const root = get().getRoot()
    const { selection } = get()
    if (!root || selection.length < 3) return
    const found = selection.map((id) => findNode(root, id)).filter(Boolean) as { node: NodeInstance; parent: NodeInstance | null }[]
    const parentIds = new Set(found.map((f) => f.parent?.id ?? 'root'))
    if (parentIds.size !== 1) return
    get().checkpoint()
    const items = found
      .map((f) => f.node)
      .sort((a, b) => (kind === 'horizontal' ? a.layout.x - b.layout.x : a.layout.y - b.layout.y))
    const start = kind === 'horizontal' ? items[0].layout.x : items[0].layout.y
    const end = kind === 'horizontal' ? items[items.length - 1].layout.x : items[items.length - 1].layout.y
    const step = (end - start) / (items.length - 1)
    let next = root
    items.forEach((it, i) => {
      const v = start + step * i
      next = updateNode(next, it.id, (x) => ({
        ...x,
        layout: kind === 'horizontal' ? { ...x.layout, x: v } : { ...x.layout, y: v }
      }))
    })
    get().setRoot(next)
  },

  // --- device / notes / zoom ---
  setZoom: (zoom) => set({ zoom }),
  setNotes: (notes) => {
    const { doc } = get()
    if (!doc) return
    set({ doc: { ...doc, notes }, dirty: true })
  },
  toggleNotes: () => set((s) => ({ notesOpen: !s.notesOpen })),

  // --- library ---
  deleteComponent: async (id) => {
    const { projectId } = get()
    if (!projectId) return
    await api.deleteComponent(projectId, id)
    set((s) => ({ components: s.components.filter((c) => c.id !== id) }))
  },

  saveAsTemplate: async (name) => {
    const { projectId } = get()
    const root = get().getRoot()
    const surface = selectSurface(get())
    if (!projectId || !root || !surface) return
    const template = await api.createTemplate(projectId, name, surface.device, root)
    set((s) => ({ templates: [...s.templates, template] }))
  },

  applyTemplate: (template) => {
    const root = get().getRoot()
    if (!root) return
    get().checkpoint()
    const children = template.definition.children.map(cloneWithNewIds)
    get().setRoot({ ...root, children })
    set({ selection: [] })
  },

  deleteTemplate: async (id) => {
    const { projectId } = get()
    if (!projectId) return
    await api.deleteTemplate(projectId, id)
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
  },

  // --- persistence ---
  saveScreen: async () => {
    const { projectId, doc } = get()
    if (!projectId || !doc) return
    set({ saving: true })
    try {
      await api.saveScreen(projectId, doc.id, {
        name: doc.name,
        notes: doc.notes,
        frames: doc.frames,
        connectors: doc.connectors
      })
      set({ dirty: false })
    } finally {
      set({ saving: false })
    }
  },

  // --- collaboration ---
  setCollaborators: (c) => set({ collaborators: c }),
  applyRemoteRoot: (frameId, root) => {
    const { doc } = get()
    if (!doc) return
    set({ doc: { ...doc, frames: doc.frames.map((f) => (f.id === frameId ? { ...f, root } : f)) }, dirty: true })
  },
  setRemoteCursor: (id, data) => set((s) => ({ remoteCursors: { ...s.remoteCursors, [id]: data } })),
  pruneCursors: (presentIds) =>
    set((s) => {
      const next: Record<string, { email: string; x: number; y: number }> = {}
      for (const [id, cur] of Object.entries(s.remoteCursors)) if (presentIds.includes(id)) next[id] = cur
      return { remoteCursors: next }
    })
}))
