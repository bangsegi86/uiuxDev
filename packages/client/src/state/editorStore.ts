import { create } from 'zustand'
import { nanoid } from 'nanoid'
import {
  createInstance,
  DEVICE_FRAMES,
  type Board,
  type BoardElement,
  type BoardElementKind,
  type BoardItem,
  type Connector,
  type CustomComponent,
  type DeviceKind,
  type GuideSet,
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
export type TabKind = 'screen' | 'board'

export interface Tab {
  kind: TabKind
  id: string
}

/** Draft used by the component editor. */
export interface ComponentDraft {
  id: string | null
  name: string
}

interface EditorState {
  // workspace
  projectId: string | null
  projectName: string
  tree: TreeNode[]
  components: CustomComponent[]
  templates: Template[]

  // open documents (IDE-style tabs)
  screens: Record<string, Screen>
  boards: Record<string, Board>
  openTabs: Tab[]
  activeTab: Tab | null
  dirty: Record<string, boolean>

  // component editor overlay
  componentDraft: ComponentDraft | null
  draftRoot: NodeInstance | null

  // canvas working state (applies to the active surface)
  selection: string[]
  clipboard: { nodes: NodeInstance[] } | null
  zoom: number
  saving: boolean
  notesOpen: boolean
  past: NodeInstance[]
  future: NodeInstance[]

  // collaboration
  collaborators: { id: string; email: string }[]
  remoteCursors: Record<string, { email: string; x: number; y: number }>

  /** i18n key of the last surfaced error (shown as a dismissible banner). */
  error: string | null
  setError: (key: string | null) => void

  // --- workspace ---
  loadProjects: () => Promise<Project[]>
  openProject: (id: string) => Promise<void>
  createProject: (name: string) => Promise<Project>
  refreshTree: () => Promise<void>
  createNode: (
    type: 'folder' | 'screen' | 'board',
    name: string,
    parentId: string | null,
    device?: DeviceKind,
    size?: { width: number; height: number }
  ) => Promise<void>
  renameNode: (nodeId: string, name: string) => Promise<void>
  renameDoc: (tab: Tab, name: string) => Promise<void>
  deleteNode: (nodeId: string) => Promise<void>

  // --- tabs ---
  openScreen: (screenId: string) => Promise<void>
  openBoard: (boardId: string) => Promise<void>
  setActiveTab: (tab: Tab) => void
  closeTab: (tab: Tab) => void

  // --- board actions ---
  addScreenToBoard: (boardId: string, screenId: string) => Promise<void>
  removeScreenFromBoard: (boardId: string, screenId: string) => void
  moveBoardItem: (boardId: string, screenId: string, x: number, y: number) => void
  addConnector: (boardId: string, from: string, to: string) => void
  updateConnector: (boardId: string, id: string, patch: Partial<Connector>) => void
  deleteConnector: (boardId: string, id: string) => void
  addBoardElement: (boardId: string, kind: BoardElementKind) => void
  updateBoardElement: (boardId: string, id: string, patch: Partial<BoardElement>) => void
  removeBoardElement: (boardId: string, id: string) => void

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

  // --- canvas actions ---
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

  // --- editor view prefs + guides ---
  ui: { ruler: boolean; grid: boolean; guides: boolean }
  toggleUi: (key: 'ruler' | 'grid' | 'guides') => void
  addGuide: (axis: 'x' | 'y', pos: number) => void
  moveGuide: (axis: 'x' | 'y', index: number, pos: number) => void
  removeGuide: (axis: 'x' | 'y', index: number) => void

  // --- device / notes / zoom ---
  setDevice: (device: DeviceKind) => void
  setCanvasSize: (width: number, height: number) => void
  setZoom: (zoom: number) => void
  setNotes: (notes: string) => void
  toggleNotes: () => void

  // --- library ---
  deleteComponent: (id: string) => Promise<void>
  saveAsTemplate: (name: string) => Promise<void>
  applyTemplate: (template: Template) => void
  deleteTemplate: (id: string) => Promise<void>

  // --- persistence ---
  saveActive: () => Promise<void>
  saveAll: () => Promise<void>
  markClean: (id: string) => void
  autosave: boolean
  toggleAutosave: () => void

  // --- internal surface helpers ---
  getRoot: () => NodeInstance | null
  setRoot: (root: NodeInstance) => void

  // --- collaboration ---
  setCollaborators: (c: { id: string; email: string }[]) => void
  applyRemoteRoot: (screenId: string, root: NodeInstance) => void
  setRemoteCursor: (id: string, data: { email: string; x: number; y: number }) => void
  pruneCursors: (presentIds: string[]) => void
}

/** The active screen, if a screen tab is active and the component editor is closed. */
function activeScreen(s: EditorState): Screen | null {
  if (s.componentDraft || s.activeTab?.kind !== 'screen') return null
  return s.screens[s.activeTab.id] ?? null
}

/** Selector: the root currently being edited (component draft or active screen). */
export function selectRoot(s: EditorState): NodeInstance | null {
  if (s.componentDraft) return s.draftRoot
  return activeScreen(s)?.root ?? null
}

/** Selector: size/device of the active surface for the canvas frame. */
export function selectSurface(s: EditorState): { width: number; height: number; device: DeviceKind } | null {
  if (s.componentDraft && s.draftRoot) {
    return { width: s.draftRoot.layout.w, height: s.draftRoot.layout.h, device: 'pc' }
  }
  const sc = activeScreen(s)
  return sc ? { width: sc.canvas.width, height: sc.canvas.height, device: sc.device } : null
}

/** Selector: the active board (if a board tab is active). */
export function selectActiveBoard(s: EditorState): Board | null {
  if (s.activeTab?.kind !== 'board') return null
  return s.boards[s.activeTab.id] ?? null
}

/** Active screen id for collaboration (null while in a board or the component editor). */
export function selectActiveScreenId(s: EditorState): string | null {
  return activeScreen(s)?.id ?? null
}

/** Shared stable empty guide set (avoids new-object selector loops in v5). */
const EMPTY_GUIDES: GuideSet = { x: [], y: [] }

/** Ruler guides for the active screen's current device. */
export function selectGuides(s: EditorState): GuideSet {
  const sc = activeScreen(s)
  return sc?.guides?.[sc.device] ?? EMPTY_GUIDES
}

const UI_KEY = 'uiux.editorUi'
function loadUi(): { ruler: boolean; grid: boolean; guides: boolean } {
  const fallback = { ruler: false, grid: false, guides: true }
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') }
  } catch {
    return fallback
  }
}

const sameTab = (a: Tab | null, b: Tab) => !!a && a.kind === b.kind && a.id === b.id

/**
 * Persist a single screen or board by id and mark it clean on success. Shared
 * by saveActive, saveAll and autosave. Throws on failure so callers can report.
 */
async function saveOne(get: () => EditorState, id: string): Promise<void> {
  const s = get()
  if (!s.projectId) return
  const sc = s.screens[id]
  const board = s.boards[id]
  if (sc) {
    await api.saveScreen(s.projectId, sc.id, {
      name: sc.name,
      device: sc.device,
      canvas: sc.canvas,
      root: sc.root,
      notes: sc.notes,
      guides: sc.guides
    })
  } else if (board) {
    await api.saveBoard(s.projectId, board.id, {
      name: board.name,
      notes: board.notes,
      items: board.items,
      connectors: board.connectors,
      elements: board.elements ?? []
    })
  } else {
    return
  }
  get().markClean(id)
}

/** Update the active screen's guides for its current device, marking it dirty. */
function writeGuides(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void,
  fn: (g: GuideSet) => GuideSet
): void {
  const s = get()
  const sc = activeScreen(s)
  if (!sc) return
  const empty: GuideSet = { x: [], y: [] }
  const base = { pc: sc.guides?.pc ?? empty, mobile: sc.guides?.mobile ?? empty }
  const guides = { ...base, [sc.device]: fn(base[sc.device]) }
  set({ screens: { ...s.screens, [sc.id]: { ...sc, guides } }, dirty: { ...s.dirty, [sc.id]: true } })
}

export const useEditor = create<EditorState>((set, get) => ({
  projectId: null,
  projectName: '',
  tree: [],
  components: [],
  templates: [],
  screens: {},
  boards: {},
  openTabs: [],
  activeTab: null,
  dirty: {},
  componentDraft: null,
  draftRoot: null,
  selection: [],
  clipboard: null,
  zoom: 1,
  saving: false,
  notesOpen: true,
  past: [],
  future: [],
  collaborators: [],
  remoteCursors: {},
  error: null,
  autosave: true,
  ui: loadUi(),

  setError: (key) => set({ error: key }),
  toggleAutosave: () => set((s) => ({ autosave: !s.autosave })),
  markClean: (id) => set((s) => ({ dirty: { ...s.dirty, [id]: false } })),

  // --- surface helpers ---
  getRoot: () => selectRoot(get()),
  setRoot: (root) => {
    const s = get()
    if (s.componentDraft) {
      set({ draftRoot: root })
      return
    }
    const sc = activeScreen(s)
    if (sc) {
      set({ screens: { ...s.screens, [sc.id]: { ...sc, root } }, dirty: { ...s.dirty, [sc.id]: true } })
    }
  },

  // --- workspace ---
  loadProjects: async () => api.listProjects(),

  openProject: async (id) => {
    // Don't discard the current workspace until the new one loads successfully.
    let loaded
    try {
      const { project, tree } = await api.getProject(id)
      const [components, templates] = await Promise.all([api.listComponents(id), api.listTemplates(id)])
      loaded = { project, tree, components, templates }
    } catch {
      get().setError('errLoad')
      return
    }
    const { project, tree, components, templates } = loaded
    set({
      projectId: id,
      projectName: project.name,
      tree,
      components,
      templates,
      screens: {},
      boards: {},
      openTabs: [],
      activeTab: null,
      dirty: {},
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

  createNode: async (type, name, parentId, device, size) => {
    const { projectId } = get()
    if (!projectId) return
    const node = await api.createTreeNode(projectId, { type, name, parentId, device })
    await get().refreshTree()
    if (type === 'screen' && node.screenId) {
      await get().openScreen(node.screenId)
      if (size) {
        get().setCanvasSize(size.width, size.height)
        await get().saveActive()
      }
    }
    if (type === 'board' && node.boardId) await get().openBoard(node.boardId)
  },

  renameNode: async (nodeId, name) => {
    const { projectId, tree } = get()
    if (!projectId) return
    const node = tree.find((n) => n.id === nodeId)
    await api.updateTreeNode(projectId, nodeId, { name })
    // Keep the backing screen/board record (and any open tab) in sync.
    if (node?.type === 'screen' && node.screenId) {
      await api.saveScreen(projectId, node.screenId, { name })
      set((s) => {
        const sc = s.screens[node.screenId!]
        return sc ? { screens: { ...s.screens, [sc.id]: { ...sc, name } } } : {}
      })
    } else if (node?.type === 'board' && node.boardId) {
      await api.saveBoard(projectId, node.boardId, { name })
      set((s) => {
        const bd = s.boards[node.boardId!]
        return bd ? { boards: { ...s.boards, [bd.id]: { ...bd, name } } } : {}
      })
    }
    await get().refreshTree()
  },

  renameDoc: async (tab, name) => {
    const node = get().tree.find((n) =>
      tab.kind === 'screen' ? n.screenId === tab.id : n.boardId === tab.id
    )
    if (node) await get().renameNode(node.id, name.trim())
  },

  deleteNode: async (nodeId) => {
    const { projectId, tree } = get()
    if (!projectId) return
    const node = tree.find((n) => n.id === nodeId)
    await api.deleteTreeNode(projectId, nodeId)
    await get().refreshTree()
    // close any tabs that referenced the removed screen/board
    if (node?.type === 'screen' && node.screenId) get().closeTab({ kind: 'screen', id: node.screenId })
    if (node?.type === 'board' && node.boardId) get().closeTab({ kind: 'board', id: node.boardId })
  },

  // --- tabs ---
  openScreen: async (screenId) => {
    const { projectId, screens } = get()
    if (!projectId) return
    if (!screens[screenId]) {
      try {
        const screen = await api.getScreen(projectId, screenId)
        set((s) => ({ screens: { ...s.screens, [screenId]: screen } }))
      } catch {
        get().setError('errLoad')
        return
      }
    }
    get().setActiveTab({ kind: 'screen', id: screenId })
  },

  openBoard: async (boardId) => {
    const { projectId, boards } = get()
    if (!projectId) return
    let board = boards[boardId]
    if (!board) {
      try {
        const loaded = await api.getBoard(projectId, boardId)
        // normalize older boards that predate `elements`
        board = { ...loaded, items: loaded.items ?? [], connectors: loaded.connectors ?? [], elements: loaded.elements ?? [] }
        set((s) => ({ boards: { ...s.boards, [boardId]: board } }))
      } catch {
        get().setError('errLoad')
        return
      }
    }
    // preload referenced screens so the board can render previews
    for (const item of board.items) {
      if (!get().screens[item.screenId]) {
        try {
          const sc = await api.getScreen(projectId, item.screenId)
          set((s) => ({ screens: { ...s.screens, [sc.id]: sc } }))
        } catch {
          // screen may have been deleted; board will skip it
        }
      }
    }
    get().setActiveTab({ kind: 'board', id: boardId })
  },

  setActiveTab: (tab) => {
    set((s) => {
      const exists = s.openTabs.some((t) => sameTab(t, tab))
      return {
        activeTab: tab,
        openTabs: exists ? s.openTabs : [...s.openTabs, tab],
        selection: [],
        past: [],
        future: [],
        remoteCursors: {}
      }
    })
  },

  closeTab: (tab) => {
    set((s) => {
      const openTabs = s.openTabs.filter((t) => !sameTab(t, tab))
      let activeTab = s.activeTab
      if (sameTab(s.activeTab, tab)) {
        activeTab = openTabs[openTabs.length - 1] ?? null
      }
      return { openTabs, activeTab, selection: [], past: [], future: [] }
    })
  },

  // --- board actions ---
  addScreenToBoard: async (boardId, screenId) => {
    const { projectId } = get()
    if (!projectId) return
    if (!get().screens[screenId]) {
      try {
        const sc = await api.getScreen(projectId, screenId)
        set((s) => ({ screens: { ...s.screens, [sc.id]: sc } }))
      } catch {
        return
      }
    }
    set((s) => {
      const board = s.boards[boardId]
      if (!board || board.items.some((i) => i.screenId === screenId)) return {}
      const offset = board.items.length
      const item: BoardItem = { screenId, x: 80 + offset * 40, y: 80 + offset * 40 }
      return {
        boards: { ...s.boards, [boardId]: { ...board, items: [...board.items, item] } },
        dirty: { ...s.dirty, [boardId]: true }
      }
    })
  },

  removeScreenFromBoard: (boardId, screenId) => {
    set((s) => {
      const board = s.boards[boardId]
      if (!board) return {}
      return {
        boards: {
          ...s.boards,
          [boardId]: {
            ...board,
            items: board.items.filter((i) => i.screenId !== screenId),
            connectors: board.connectors.filter((c) => c.from !== screenId && c.to !== screenId)
          }
        },
        dirty: { ...s.dirty, [boardId]: true }
      }
    })
  },

  moveBoardItem: (boardId, screenId, x, y) => {
    set((s) => {
      const board = s.boards[boardId]
      if (!board) return {}
      return {
        boards: {
          ...s.boards,
          [boardId]: {
            ...board,
            items: board.items.map((i) => (i.screenId === screenId ? { ...i, x, y } : i))
          }
        },
        dirty: { ...s.dirty, [boardId]: true }
      }
    })
  },

  addConnector: (boardId, from, to) => {
    set((s) => {
      const board = s.boards[boardId]
      if (!board || from === to) return {}
      if (board.connectors.some((c) => c.from === from && c.to === to)) return {}
      return {
        boards: {
          ...s.boards,
          [boardId]: { ...board, connectors: [...board.connectors, { id: nanoid(8), from, to }] }
        },
        dirty: { ...s.dirty, [boardId]: true }
      }
    })
  },

  updateConnector: (boardId, id, patch) => {
    set((s) => {
      const board = s.boards[boardId]
      if (!board) return {}
      return {
        boards: {
          ...s.boards,
          [boardId]: { ...board, connectors: board.connectors.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
        },
        dirty: { ...s.dirty, [boardId]: true }
      }
    })
  },

  deleteConnector: (boardId, id) => {
    set((s) => {
      const board = s.boards[boardId]
      if (!board) return {}
      return {
        boards: { ...s.boards, [boardId]: { ...board, connectors: board.connectors.filter((c) => c.id !== id) } },
        dirty: { ...s.dirty, [boardId]: true }
      }
    })
  },

  addBoardElement: (boardId, kind) => {
    set((s) => {
      const board = s.boards[boardId]
      if (!board) return {}
      const n = (board.elements ?? []).length
      const base = { id: nanoid(8), kind, x: 80 + n * 24, y: 80 + n * 24 }
      const el: BoardElement =
        kind === 'memo'
          ? { ...base, w: 180, h: 120, text: '메모', color: '#fff8c5' }
          : kind === 'image'
            ? { ...base, w: 200, h: 140, src: '' }
            : { ...base, w: 200, h: 40, text: '텍스트' }
      return {
        boards: { ...s.boards, [boardId]: { ...board, elements: [...(board.elements ?? []), el] } },
        dirty: { ...s.dirty, [boardId]: true }
      }
    })
  },

  updateBoardElement: (boardId, id, patch) => {
    set((s) => {
      const board = s.boards[boardId]
      if (!board) return {}
      return {
        boards: {
          ...s.boards,
          [boardId]: { ...board, elements: (board.elements ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)) }
        },
        dirty: { ...s.dirty, [boardId]: true }
      }
    })
  },

  removeBoardElement: (boardId, id) => {
    set((s) => {
      const board = s.boards[boardId]
      if (!board) return {}
      return {
        boards: { ...s.boards, [boardId]: { ...board, elements: (board.elements ?? []).filter((e) => e.id !== id) } },
        dirty: { ...s.dirty, [boardId]: true }
      }
    })
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

  closeComponentEditor: () => set({ componentDraft: null, draftRoot: null, selection: [], past: [], future: [] }),

  saveComponentDraft: async () => {
    const { projectId, componentDraft, draftRoot } = get()
    if (!projectId || !componentDraft || !draftRoot) return
    const name = componentDraft.name.trim() || 'Component'
    try {
      if (componentDraft.id) {
        const updated = await api.updateComponent(projectId, componentDraft.id, name, draftRoot)
        set((s) => ({ components: s.components.map((c) => (c.id === updated.id ? updated : c)) }))
      } else {
        const created = await api.createComponent(projectId, name, draftRoot)
        set((s) => ({ components: [...s.components, created] }))
      }
      get().closeComponentEditor()
    } catch {
      get().setError('errSave')
    }
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
    set({ past: past.slice(0, -1), future: [root, ...future].slice(0, 50), selection: [] })
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
      s.selection.includes(id) ? { selection: s.selection.filter((x) => x !== id) } : { selection: [...s.selection, id] }
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
  setDevice: (device) => {
    const s = get()
    const sc = activeScreen(s)
    if (!sc) return
    get().checkpoint()
    const f = DEVICE_FRAMES[device]
    const next: Screen = {
      ...sc,
      device,
      canvas: { width: f.width, height: f.height },
      root: { ...sc.root, layout: { ...sc.root.layout, w: f.width, h: f.height } }
    }
    set({ screens: { ...s.screens, [sc.id]: next }, dirty: { ...s.dirty, [sc.id]: true } })
  },

  setCanvasSize: (width, height) => {
    const s = get()
    const sc = activeScreen(s)
    if (!sc) return
    const w = Math.max(64, Math.round(width))
    const h = Math.max(64, Math.round(height))
    get().checkpoint()
    const next: Screen = {
      ...sc,
      canvas: { width: w, height: h },
      root: { ...sc.root, layout: { ...sc.root.layout, w, h } }
    }
    set({ screens: { ...s.screens, [sc.id]: next }, dirty: { ...s.dirty, [sc.id]: true } })
  },

  setZoom: (zoom) => set({ zoom }),

  toggleUi: (key) =>
    set((s) => {
      const ui = { ...s.ui, [key]: !s.ui[key] }
      try {
        localStorage.setItem(UI_KEY, JSON.stringify(ui))
      } catch {
        // storage unavailable; keep in-memory only
      }
      return { ui }
    }),

  addGuide: (axis, pos) => writeGuides(get, set, (g) => ({ ...g, [axis]: [...g[axis], Math.round(pos)] })),
  moveGuide: (axis, index, pos) =>
    writeGuides(get, set, (g) => ({ ...g, [axis]: g[axis].map((v, i) => (i === index ? Math.round(pos) : v)) })),
  removeGuide: (axis, index) =>
    writeGuides(get, set, (g) => ({ ...g, [axis]: g[axis].filter((_, i) => i !== index) })),

  setNotes: (notes) => {
    const s = get()
    const sc = activeScreen(s)
    if (!sc) return
    set({ screens: { ...s.screens, [sc.id]: { ...sc, notes } }, dirty: { ...s.dirty, [sc.id]: true } })
  },

  toggleNotes: () => set((s) => ({ notesOpen: !s.notesOpen })),

  // --- library ---
  deleteComponent: async (id) => {
    const { projectId } = get()
    if (!projectId) return
    try {
      await api.deleteComponent(projectId, id)
      set((s) => ({ components: s.components.filter((c) => c.id !== id) }))
    } catch {
      get().setError('errDelete')
    }
  },

  saveAsTemplate: async (name) => {
    const { projectId } = get()
    const root = get().getRoot()
    const surface = selectSurface(get())
    if (!projectId || !root || !surface) return
    try {
      const template = await api.createTemplate(projectId, name, surface.device, root)
      set((s) => ({ templates: [...s.templates, template] }))
    } catch {
      get().setError('errSave')
    }
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
    try {
      await api.deleteTemplate(projectId, id)
      set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
    } catch {
      get().setError('errDelete')
    }
  },

  // --- persistence ---
  saveActive: async () => {
    const { activeTab } = get()
    if (!activeTab) return
    set({ saving: true })
    try {
      await saveOne(get, activeTab.id)
    } catch {
      get().setError('errSave')
    } finally {
      set({ saving: false })
    }
  },

  // Persist every document with unsaved changes (used by autosave + on demand).
  saveAll: async () => {
    const ids = Object.keys(get().dirty).filter((id) => get().dirty[id])
    if (!ids.length) return
    set({ saving: true })
    let failed = false
    try {
      for (const id of ids) {
        try {
          await saveOne(get, id)
        } catch {
          failed = true
        }
      }
    } finally {
      set({ saving: false })
    }
    if (failed) get().setError('errSave')
  },

  // --- collaboration ---
  setCollaborators: (c) => set({ collaborators: c }),
  applyRemoteRoot: (screenId, root) => {
    set((s) => {
      const sc = s.screens[screenId]
      if (!sc) return {}
      return { screens: { ...s.screens, [screenId]: { ...sc, root } }, dirty: { ...s.dirty, [screenId]: true } }
    })
  },
  setRemoteCursor: (id, data) => set((s) => ({ remoteCursors: { ...s.remoteCursors, [id]: data } })),
  pruneCursors: (presentIds) =>
    set((s) => {
      const next: Record<string, { email: string; x: number; y: number }> = {}
      for (const [id, cur] of Object.entries(s.remoteCursors)) if (presentIds.includes(id)) next[id] = cur
      return { remoteCursors: next }
    })
}))
