/**
 * Core domain models for the WYSIWYG UI/UX builder.
 *
 * These types are the single source of truth shared by the server and client.
 * Runtime validators for the same shapes live in `schemas.ts` (Zod).
 */

export type DeviceKind = 'pc' | 'mobile'

/** Frame sizes (in CSS px) used by the canvas for each device. */
export const DEVICE_FRAMES: Record<DeviceKind, { width: number; height: number }> = {
  pc: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 }
}

/** Absolute position + size of a component on the canvas. */
export interface Layout {
  x: number
  y: number
  w: number
  h: number
}

/**
 * A single placed component on the canvas. Trees of these make up a screen.
 * `type` references either a primitive (see `primitives.ts`) or, when it is
 * `custom:<componentId>`, an instance of a user-defined component.
 */
export interface NodeInstance {
  id: string
  type: string
  props: Record<string, unknown>
  style: Record<string, string>
  layout: Layout
  children: NodeInstance[]
}

/** Button/action behaviour referenced by a developer spec. */
export type ButtonActionType = 'navigate' | 'submit' | 'openModal' | 'custom'

/**
 * Developer-facing specification attached to an element (stored in
 * `NodeInstance.props.spec`). Lets designers document behaviour and constraints
 * so developers can reference them in the property panel, the HTML export, and
 * the generated spec sheet.
 */
export interface ElementSpec {
  // common to every element
  behavior?: string
  devNote?: string
  ticketRef?: string
  // input / calendar
  maxLength?: number
  minLength?: number
  pattern?: string
  validationMessage?: string
  // button
  actionType?: ButtonActionType
  actionTarget?: string
  actionDescription?: string
  // radio / checkbox / grid
  dataSource?: string
}

/** True when a spec is missing or every field is blank. */
export function isSpecEmpty(spec?: ElementSpec): boolean {
  if (!spec) return true
  return Object.values(spec).every((v) => v === undefined || v === null || v === '')
}

/** An application user (account). */
export interface User {
  id: string
  email: string
  createdAt: string
}

/** A project groups a tree of folders and screens. Owned by a user. */
export interface Project {
  id: string
  name: string
  /** Owner user id. Optional for legacy data created before auth. */
  ownerId?: string
  /** Ruler guides shared across the project's screens, split by device. */
  guides?: { pc: GuideSet; mobile: GuideSet }
  createdAt: string
  updatedAt: string
}

export type TreeNodeType = 'folder' | 'screen' | 'board'

/** A node in the project's file-explorer tree (folder, screen, or board file). */
export interface TreeNode {
  id: string
  projectId: string
  parentId: string | null
  type: TreeNodeType
  name: string
  /** Sort order among siblings. */
  order: number
  /** For `screen` nodes, the id of the backing Screen. */
  screenId?: string
  /** For `board` nodes, the id of the backing Board. */
  boardId?: string
}

/** Ruler guide lines: x = vertical guides (at x positions), y = horizontal. */
export interface GuideSet {
  x: number[]
  y: number[]
}

/** A single screen design (one canvas). Each screen is its own file. */
export interface Screen {
  id: string
  name: string
  device: DeviceKind
  canvas: { width: number; height: number }
  root: NodeInstance
  /** Free-form design reference notes shown in the collapsible bottom panel. */
  notes: string
  createdAt: string
  updatedAt: string
}

/** A screen placed on a board, with its position. */
export interface BoardItem {
  screenId: string
  x: number
  y: number
}

/** A relationship/flow arrow between two screens on a board. */
export interface Connector {
  id: string
  from: string // screenId
  to: string // screenId
  label?: string
}

/** A free-floating, board-only element (sticky memo, label, image). */
export type BoardElementKind = 'memo' | 'text' | 'image'
export interface BoardElement {
  id: string
  kind: BoardElementKind
  x: number
  y: number
  w: number
  h: number
  text?: string
  src?: string
  color?: string
  fontSize?: number
  align?: 'left' | 'center' | 'right'
}

/**
 * A flow board (its own file): references existing screens by id, positions
 * them, draws connectors, and can carry board-only elements (memos/images).
 */
export interface Board {
  id: string
  name: string
  items: BoardItem[]
  connectors: Connector[]
  elements: BoardElement[]
  notes: string
  createdAt: string
  updatedAt: string
}

/** A user-defined, reusable component built in the component editor (no-code). */
export interface CustomComponent {
  id: string
  name: string
  thumbnail?: string
  definition: NodeInstance
  createdAt: string
  updatedAt: string
}

/** A reusable whole-screen design ("자주 쓰는 화면 디자인"). */
export interface Template {
  id: string
  name: string
  thumbnail?: string
  device: DeviceKind
  definition: NodeInstance
  createdAt: string
  updatedAt: string
}

/** Convenience factory for an empty root container of a screen. */
export function emptyRoot(device: DeviceKind): NodeInstance {
  const frame = DEVICE_FRAMES[device]
  return {
    id: 'root',
    type: 'container',
    props: {},
    style: { background: '#ffffff' },
    layout: { x: 0, y: 0, w: frame.width, h: frame.height },
    children: []
  }
}
