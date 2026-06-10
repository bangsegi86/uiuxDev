import { create } from 'zustand'
import { nanoid } from 'nanoid'
import {
  createInstance,
  DEVICE_FRAMES,
  type CustomComponent,
  type DeviceKind,
  type Layout,
  type NodeInstance,
  type Project,
  type Screen,
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

interface EditorState {
  // workspace
  projectId: string | null
  projectName: string
  tree: TreeNode[]
  components: CustomComponent[]
  templates: Template[]

  // active screen
  screen: Screen | null
  selection: string[]
  clipboard: { parentId: string; nodes: NodeInstance[] } | null
  zoom: number
  saving: boolean
  dirty: boolean
  notesOpen: boolean

  // history (undo/redo) — snapshots of the whole screen
  past: Screen[]
  future: Screen[]

  // workspace actions
  loadProjects: () => Promise<Project[]>
  openProject: (id: string) => Promise<void>
  createProject: (name: string) => Promise<Project>
  refreshTree: () => Promise<void>
  createNode: (
    type: 'folder' | 'screen',
    name: string,
    parentId: string | null,
    device?: DeviceKind
  ) => Promise<void>
  renameNode: (nodeId: string, name: string) => Promise<void>
  deleteNode: (nodeId: string) => Promise<void>
  openScreen: (screenId: string) => Promise<void>

  // history actions
  checkpoint: () => void
  undo: () => void
  redo: () => void

  // canvas actions
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

  // device / notes
  setDevice: (device: DeviceKind) => void
  setZoom: (zoom: number) => void
  setNotes: (notes: string) => void
  toggleNotes: () => void

  // library
  saveAsComponent: (name: string) => Promise<void>
  deleteComponent: (id: string) => Promise<void>
  saveAsTemplate: (name: string) => Promise<void>
  applyTemplate: (template: Template) => void
  deleteTemplate: (id: string) => Promise<void>

  // persistence
  saveScreen: () => Promise<void>
}

export const useEditor = create<EditorState>((set, get) => ({
  projectId: null,
  projectName: '',
  tree: [],
  components: [],
  templates: [],
  screen: null,
  selection: [],
  clipboard: null,
  zoom: 1,
  saving: false,
  dirty: false,
  notesOpen: true,
  past: [],
  future: [],

  // Snapshot the current screen before an edit gesture so it can be undone.
  // Consecutive calls with no intervening change are de-duplicated by reference.
  checkpoint: () => {
    const { screen, past } = get()
    if (!screen) return
    if (past[past.length - 1] === screen) return
    set({ past: [...past, screen].slice(-50), future: [] })
  },

  undo: () => {
    const { past, future, screen } = get()
    if (!past.length || !screen) return
    const prev = past[past.length - 1]
    set({ screen: prev, past: past.slice(0, -1), future: [screen, ...future], selection: [], dirty: true })
  },

  redo: () => {
    const { past, future, screen } = get()
    if (!future.length || !screen) return
    const next = future[0]
    set({ screen: next, future: future.slice(1), past: [...past, screen], selection: [], dirty: true })
  },

  loadProjects: async () => api.listProjects(),

  openProject: async (id) => {
    const { project, tree } = await api.getProject(id)
    const [components, templates] = await Promise.all([
      api.listComponents(id),
      api.listTemplates(id)
    ])
    set({
      projectId: id,
      projectName: project.name,
      tree,
      components,
      templates,
      screen: null,
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
    const { projectId, tree, screen } = get()
    if (!projectId) return
    const node = tree.find((n) => n.id === nodeId)
    await api.deleteTreeNode(projectId, nodeId)
    await get().refreshTree()
    if (node?.type === 'screen' && node.screenId === screen?.id) {
      set({ screen: null, selection: [] })
    }
  },

  openScreen: async (screenId) => {
    const { projectId } = get()
    if (!projectId) return
    const screen = await api.getScreen(projectId, screenId)
    set({ screen, selection: [], dirty: false, past: [], future: [] })
  },

  setSelection: (ids) => set({ selection: ids }),
  toggleSelection: (id) =>
    set((s) =>
      s.selection.includes(id)
        ? { selection: s.selection.filter((x) => x !== id) }
        : { selection: [...s.selection, id] }
    ),

  insertPrimitive: (type, at, parentId = 'root') => {
    const { screen } = get()
    if (!screen) return
    get().checkpoint()
    const inst = createInstance(type, nanoid(10), at)
    set({
      screen: { ...screen, root: insertChildren(screen.root, parentId, [inst]) },
      selection: [inst.id],
      dirty: true
    })
  },

  insertDefinition: (def, at, parentId = 'root') => {
    const { screen } = get()
    if (!screen) return
    get().checkpoint()
    const instances = expandDefinition(def, at)
    set({
      screen: { ...screen, root: insertChildren(screen.root, parentId, instances) },
      selection: instances.map((i) => i.id),
      dirty: true
    })
  },

  /** Insert a *linked* custom-component instance (renders live from its definition). */
  insertComponentInstance: (componentId, at, parentId = 'root') => {
    const { screen, components } = get()
    if (!screen) return
    const comp = components.find((c) => c.id === componentId)
    if (!comp) return
    get().checkpoint()
    const inst: NodeInstance = {
      id: nanoid(10),
      type: `custom:${componentId}`,
      props: {},
      style: {},
      layout: { x: at.x, y: at.y, w: comp.definition.layout.w, h: comp.definition.layout.h },
      children: []
    }
    set({
      screen: { ...screen, root: insertChildren(screen.root, parentId, [inst]) },
      selection: [inst.id],
      dirty: true
    })
  },

  /** Break a linked instance into editable primitives at its position/scale. */
  detachComponentInstance: (id) => {
    const { screen, components } = get()
    if (!screen) return
    const found = findNode(screen.root, id)
    if (!found || !found.node.type.startsWith('custom:')) return
    const comp = components.find((c) => c.id === found.node.type.slice('custom:'.length))
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
    let root = removeNodes(screen.root, new Set([id]))
    root = insertChildren(root, parentId, expanded)
    set({ screen: { ...screen, root }, selection: expanded.map((e) => e.id), dirty: true })
  },

  updateLayout: (id, patch) => {
    const { screen } = get()
    if (!screen) return
    set({
      screen: {
        ...screen,
        root: updateNode(screen.root, id, (n) => ({ ...n, layout: { ...n.layout, ...patch } }))
      },
      dirty: true
    })
  },

  updateProp: (id, key, value) => {
    const { screen } = get()
    if (!screen) return
    set({
      screen: {
        ...screen,
        root: updateNode(screen.root, id, (n) => ({ ...n, props: { ...n.props, [key]: value } }))
      },
      dirty: true
    })
  },

  updateStyle: (id, key, value) => {
    const { screen } = get()
    if (!screen) return
    set({
      screen: {
        ...screen,
        root: updateNode(screen.root, id, (n) => ({ ...n, style: { ...n.style, [key]: value } }))
      },
      dirty: true
    })
  },

  /** Re-parent a single node into the deepest container under a canvas point. */
  reparent: (id, absPoint) => {
    const { screen } = get()
    if (!screen) return
    const found = findNode(screen.root, id)
    if (!found) return
    const exclude = new Set<string>([id, ...descendantIds(found.node)])
    const target = deepestContainerAt(screen.root, absPoint.x, absPoint.y, exclude)
    const currentParentId = found.parent?.id ?? 'root'
    if (target.id === currentParentId) return
    // Absolute origin of the node, converted into the new parent's frame.
    const abs = absoluteOrigin(screen.root, id)!
    const newLayout = { ...found.node.layout, x: abs.x - target.originX, y: abs.y - target.originY }
    get().checkpoint()
    const detached = { ...found.node, layout: newLayout }
    let root = removeNodes(screen.root, new Set([id]))
    root = insertChildren(root, target.id, [detached])
    set({ screen: { ...screen, root }, dirty: true })
  },

  copy: () => {
    const { screen, selection } = get()
    if (!screen || !selection.length) return
    const nodes: NodeInstance[] = []
    let parentId = 'root'
    for (const sid of selection) {
      const f = findNode(screen.root, sid)
      if (f) {
        nodes.push(f.node)
        parentId = f.parent?.id ?? 'root'
      }
    }
    if (nodes.length) set({ clipboard: { parentId, nodes } })
  },

  paste: () => {
    const { screen, clipboard } = get()
    if (!screen || !clipboard?.nodes.length) return
    get().checkpoint()
    const clones = clipboard.nodes.map((c) => {
      const copy = cloneWithNewIds(c)
      return { ...copy, layout: { ...copy.layout, x: copy.layout.x + 24, y: copy.layout.y + 24 } }
    })
    const target = findNode(screen.root, clipboard.parentId) ? clipboard.parentId : 'root'
    set({
      screen: { ...screen, root: insertChildren(screen.root, target, clones) },
      selection: clones.map((c) => c.id),
      dirty: true
    })
  },

  duplicate: () => {
    get().copy()
    get().paste()
  },

  remove: () => {
    const { screen, selection } = get()
    if (!screen || !selection.length) return
    get().checkpoint()
    set({
      screen: { ...screen, root: removeNodes(screen.root, new Set(selection)) },
      selection: [],
      dirty: true
    })
  },

  align: (kind) => {
    const { screen, selection } = get()
    if (!screen || selection.length < 2) return
    const found = selection.map((id) => findNode(screen.root, id)).filter(Boolean) as { node: NodeInstance; parent: NodeInstance | null }[]
    // Alignment is only meaningful among siblings (same parent frame).
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
    let root = screen.root
    for (const n of items) root = updateNode(root, n.id, (x) => ({ ...x, layout: { ...x.layout, ...newLayout(x) } }))
    set({ screen: { ...screen, root }, dirty: true })
  },

  distribute: (kind) => {
    const { screen, selection } = get()
    if (!screen || selection.length < 3) return
    const found = selection.map((id) => findNode(screen.root, id)).filter(Boolean) as { node: NodeInstance; parent: NodeInstance | null }[]
    const parentIds = new Set(found.map((f) => f.parent?.id ?? 'root'))
    if (parentIds.size !== 1) return
    get().checkpoint()
    const items = found
      .map((f) => f.node)
      .sort((a, b) => (kind === 'horizontal' ? a.layout.x - b.layout.x : a.layout.y - b.layout.y))
    const start = kind === 'horizontal' ? items[0].layout.x : items[0].layout.y
    const end =
      kind === 'horizontal' ? items[items.length - 1].layout.x : items[items.length - 1].layout.y
    const step = (end - start) / (items.length - 1)
    let root = screen.root
    items.forEach((it, i) => {
      const v = start + step * i
      root = updateNode(root, it.id, (x) => ({
        ...x,
        layout: kind === 'horizontal' ? { ...x.layout, x: v } : { ...x.layout, y: v }
      }))
    })
    set({ screen: { ...screen, root }, dirty: true })
  },

  setDevice: (device) => {
    const { screen } = get()
    if (!screen) return
    get().checkpoint()
    const frame = DEVICE_FRAMES[device]
    set({
      screen: {
        ...screen,
        device,
        canvas: { width: frame.width, height: frame.height },
        root: { ...screen.root, layout: { ...screen.root.layout, w: frame.width, h: frame.height } }
      },
      dirty: true
    })
  },

  setZoom: (zoom) => set({ zoom }),
  setNotes: (notes) => {
    const { screen } = get()
    if (!screen) return
    set({ screen: { ...screen, notes }, dirty: true })
  },
  toggleNotes: () => set((s) => ({ notesOpen: !s.notesOpen })),

  saveAsComponent: async (name) => {
    const { projectId, screen, selection } = get()
    if (!projectId || !screen || !selection.length) return
    const items = selection
      .map((id) => findNode(screen.root, id)?.node)
      .filter(Boolean) as NodeInstance[]
    const def = groupIntoDefinition(items)
    const component = await api.createComponent(projectId, name, def)
    set((s) => ({ components: [...s.components, component] }))
  },

  deleteComponent: async (id) => {
    const { projectId } = get()
    if (!projectId) return
    await api.deleteComponent(projectId, id)
    set((s) => ({ components: s.components.filter((c) => c.id !== id) }))
  },

  saveAsTemplate: async (name) => {
    const { projectId, screen } = get()
    if (!projectId || !screen) return
    const template = await api.createTemplate(projectId, name, screen.device, screen.root)
    set((s) => ({ templates: [...s.templates, template] }))
  },

  applyTemplate: (template) => {
    const { screen } = get()
    if (!screen) return
    get().checkpoint()
    const children = template.definition.children.map(cloneWithNewIds)
    set({
      screen: { ...screen, root: { ...screen.root, children } },
      selection: [],
      dirty: true
    })
  },

  deleteTemplate: async (id) => {
    const { projectId } = get()
    if (!projectId) return
    await api.deleteTemplate(projectId, id)
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
  },

  saveScreen: async () => {
    const { projectId, screen } = get()
    if (!projectId || !screen) return
    set({ saving: true })
    try {
      await api.saveScreen(projectId, screen.id, {
        name: screen.name,
        device: screen.device,
        canvas: screen.canvas,
        root: screen.root,
        notes: screen.notes
      })
      set({ dirty: false })
    } finally {
      set({ saving: false })
    }
  }
}))
