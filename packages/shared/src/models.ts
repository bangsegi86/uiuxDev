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

/**
 * A flow board (its own file): references existing screens by id, positions
 * them, and draws connectors to express the navigation/flow between them.
 */
export interface Board {
  id: string
  name: string
  items: BoardItem[]
  connectors: Connector[]
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
