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
  boundingBox,
  cloneWithNewIds,
  expandDefinition,
  groupIntoDefinition
} from './instanceUtils'

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
  clipboard: NodeInstance[] | null
  zoom: number
  saving: boolean
  dirty: boolean
  notesOpen: boolean

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

  // canvas actions
  setSelection: (ids: string[]) => void
  toggleSelection: (id: string) => void
  insertPrimitive: (type: string, at: { x: number; y: number }) => void
  insertDefinition: (def: NodeInstance, at: { x: number; y: number }) => void
  updateLayout: (id: string, patch: Partial<Layout>) => void
  updateProp: (id: string, key: string, value: unknown) => void
  updateStyle: (id: string, key: string, value: string) => void
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

/** Replace one top-level instance immutably and return a new children array. */
function patchChild(
  children: NodeInstance[],
  id: string,
  fn: (n: NodeInstance) => NodeInstance
): NodeInstance[] {
  return children.map((c) => (c.id === id ? fn(c) : c))
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
    set({ screen, selection: [], dirty: false })
  },

  setSelection: (ids) => set({ selection: ids }),
  toggleSelection: (id) =>
    set((s) =>
      s.selection.includes(id)
        ? { selection: s.selection.filter((x) => x !== id) }
        : { selection: [...s.selection, id] }
    ),

  insertPrimitive: (type, at) => {
    const { screen } = get()
    if (!screen) return
    const inst = createInstance(type, nanoid(10), at)
    set({
      screen: { ...screen, root: { ...screen.root, children: [...screen.root.children, inst] } },
      selection: [inst.id],
      dirty: true
    })
  },

  insertDefinition: (def, at) => {
    const { screen } = get()
    if (!screen) return
    const instances = expandDefinition(def, at)
    set({
      screen: {
        ...screen,
        root: { ...screen.root, children: [...screen.root.children, ...instances] }
      },
      selection: instances.map((i) => i.id),
      dirty: true
    })
  },

  updateLayout: (id, patch) => {
    const { screen } = get()
    if (!screen) return
    set({
      screen: {
        ...screen,
        root: {
          ...screen.root,
          children: patchChild(screen.root.children, id, (n) => ({
            ...n,
            layout: { ...n.layout, ...patch }
          }))
        }
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
        root: {
          ...screen.root,
          children: patchChild(screen.root.children, id, (n) => ({
            ...n,
            props: { ...n.props, [key]: value }
          }))
        }
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
        root: {
          ...screen.root,
          children: patchChild(screen.root.children, id, (n) => ({
            ...n,
            style: { ...n.style, [key]: value }
          }))
        }
      },
      dirty: true
    })
  },

  copy: () => {
    const { screen, selection } = get()
    if (!screen) return
    const items = screen.root.children.filter((c) => selection.includes(c.id))
    if (items.length) set({ clipboard: items.map((i) => ({ ...i })) })
  },

  paste: () => {
    const { screen, clipboard } = get()
    if (!screen || !clipboard?.length) return
    const clones = clipboard.map((c) => {
      const copy = cloneWithNewIds(c)
      return { ...copy, layout: { ...copy.layout, x: copy.layout.x + 24, y: copy.layout.y + 24 } }
    })
    set({
      screen: { ...screen, root: { ...screen.root, children: [...screen.root.children, ...clones] } },
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
    set({
      screen: {
        ...screen,
        root: {
          ...screen.root,
          children: screen.root.children.filter((c) => !selection.includes(c.id))
        }
      },
      selection: [],
      dirty: true
    })
  },

  align: (kind) => {
    const { screen, selection } = get()
    if (!screen || selection.length < 2) return
    const items = screen.root.children.filter((c) => selection.includes(c.id))
    const box = boundingBox(items)
    const move = (n: NodeInstance): NodeInstance => {
      const l = { ...n.layout }
      switch (kind) {
        case 'left':
          l.x = box.x
          break
        case 'right':
          l.x = box.x + box.w - l.w
          break
        case 'centerH':
          l.x = box.x + (box.w - l.w) / 2
          break
        case 'top':
          l.y = box.y
          break
        case 'bottom':
          l.y = box.y + box.h - l.h
          break
        case 'middle':
          l.y = box.y + (box.h - l.h) / 2
          break
      }
      return { ...n, layout: l }
    }
    set({
      screen: {
        ...screen,
        root: {
          ...screen.root,
          children: screen.root.children.map((c) => (selection.includes(c.id) ? move(c) : c))
        }
      },
      dirty: true
    })
  },

  distribute: (kind) => {
    const { screen, selection } = get()
    if (!screen || selection.length < 3) return
    const items = screen.root.children
      .filter((c) => selection.includes(c.id))
      .sort((a, b) => (kind === 'horizontal' ? a.layout.x - b.layout.x : a.layout.y - b.layout.y))
    const first = items[0]
    const last = items[items.length - 1]
    const start = kind === 'horizontal' ? first.layout.x : first.layout.y
    const end = kind === 'horizontal' ? last.layout.x : last.layout.y
    const step = (end - start) / (items.length - 1)
    const positions = new Map<string, number>()
    items.forEach((it, i) => positions.set(it.id, start + step * i))
    set({
      screen: {
        ...screen,
        root: {
          ...screen.root,
          children: screen.root.children.map((c) => {
            if (!positions.has(c.id)) return c
            const v = positions.get(c.id)!
            return {
              ...c,
              layout: kind === 'horizontal' ? { ...c.layout, x: v } : { ...c.layout, y: v }
            }
          })
        }
      },
      dirty: true
    })
  },

  setDevice: (device) => {
    const { screen } = get()
    if (!screen) return
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
    const items = screen.root.children.filter((c) => selection.includes(c.id))
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
