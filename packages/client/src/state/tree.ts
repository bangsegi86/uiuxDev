import { nanoid } from 'nanoid'
import { isContainerType, type Layout, type NodeInstance } from '@uiux/shared'

/**
 * Tree helpers for the nested canvas model. Each node's `layout` (x, y) is
 * relative to its parent's content box, so a node can live at any depth.
 */

export interface Found {
  node: NodeInstance
  parent: NodeInstance | null
}

/** Locate a node and its parent anywhere in the tree. */
export function findNode(root: NodeInstance, id: string, parent: NodeInstance | null = null): Found | null {
  if (root.id === id) return { node: root, parent }
  for (const child of root.children) {
    const hit = findNode(child, id, root)
    if (hit) return hit
  }
  return null
}

/** Immutably replace a node by id. */
export function updateNode(
  root: NodeInstance,
  id: string,
  fn: (n: NodeInstance) => NodeInstance
): NodeInstance {
  if (root.id === id) return fn(root)
  let changed = false
  const children = root.children.map((c) => {
    const next = updateNode(c, id, fn)
    if (next !== c) changed = true
    return next
  })
  return changed ? { ...root, children } : root
}

/** Immutably remove a set of node ids (and their descendants). */
export function removeNodes(root: NodeInstance, ids: Set<string>): NodeInstance {
  const children = root.children
    .filter((c) => !ids.has(c.id))
    .map((c) => removeNodes(c, ids))
  return { ...root, children }
}

/** Insert children at the end of a parent's child list. */
export function insertChildren(root: NodeInstance, parentId: string, nodes: NodeInstance[]): NodeInstance {
  return updateNode(root, parentId, (p) => ({ ...p, children: [...p.children, ...nodes] }))
}

/** Absolute top-left of a node within the canvas, summing relative layouts. */
export function absoluteOrigin(root: NodeInstance, id: string): { x: number; y: number } | null {
  const path = pathTo(root, id)
  if (!path) return null
  let x = 0
  let y = 0
  // skip the root itself (origin 0,0); add each descendant's relative layout
  for (let i = 1; i < path.length; i++) {
    x += path[i].layout.x
    y += path[i].layout.y
  }
  return { x, y }
}

/** Chain of nodes from root down to the target (inclusive). */
export function pathTo(root: NodeInstance, id: string, acc: NodeInstance[] = []): NodeInstance[] | null {
  const next = [...acc, root]
  if (root.id === id) return next
  for (const child of root.children) {
    const hit = pathTo(child, id, next)
    if (hit) return hit
  }
  return null
}

/** All descendant ids of a node (excluding itself). */
export function descendantIds(node: NodeInstance): Set<string> {
  const out = new Set<string>()
  const walk = (n: NodeInstance) => n.children.forEach((c) => { out.add(c.id); walk(c) })
  walk(node)
  return out
}

/**
 * Deepest container whose absolute box contains (x, y), ignoring `exclude`
 * (e.g. the node being dragged and its descendants). Returns the container id
 * and its absolute origin so callers can convert to relative coordinates.
 */
export function deepestContainerAt(
  root: NodeInstance,
  x: number,
  y: number,
  exclude: Set<string>,
  originX = 0,
  originY = 0
): { id: string; originX: number; originY: number } {
  let best = { id: root.id, originX, originY }
  for (const child of root.children) {
    if (exclude.has(child.id)) continue
    if (!isContainerType(child.type)) continue
    const cx = originX + child.layout.x
    const cy = originY + child.layout.y
    const inside = x >= cx && x <= cx + child.layout.w && y >= cy && y <= cy + child.layout.h
    if (inside) {
      const deeper = deepestContainerAt(child, x, y, exclude, cx, cy)
      best = deeper
    }
  }
  return best
}

/** Deep-clone a subtree with fresh ids throughout. */
export function cloneWithNewIds(node: NodeInstance): NodeInstance {
  return {
    ...node,
    id: nanoid(10),
    props: { ...node.props },
    style: { ...node.style },
    layout: { ...node.layout },
    children: node.children.map(cloneWithNewIds)
  }
}

/** Bounding box (in their shared parent's frame) around sibling nodes. */
export function boundingBox(items: NodeInstance[]): Layout {
  if (items.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const it of items) {
    minX = Math.min(minX, it.layout.x)
    minY = Math.min(minY, it.layout.y)
    maxX = Math.max(maxX, it.layout.x + it.layout.w)
    maxY = Math.max(maxY, it.layout.y + it.layout.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * Build a custom-component definition from selected sibling nodes: a container
 * sized to their bounding box, with the nodes re-based to box-relative coords.
 */
export function groupIntoDefinition(items: NodeInstance[]): NodeInstance {
  const box = boundingBox(items)
  return {
    id: nanoid(10),
    type: 'container',
    props: {},
    style: { background: 'transparent' },
    layout: { x: 0, y: 0, w: box.w, h: box.h },
    children: items.map((it) => ({
      ...cloneWithNewIds(it),
      layout: { ...it.layout, x: it.layout.x - box.x, y: it.layout.y - box.y }
    }))
  }
}

/**
 * Expand a definition's children into fresh nodes offset by a drop point
 * (expressed in the target parent's frame). Used for templates and the
 * "detach" action on a custom component instance.
 */
export function expandDefinition(def: NodeInstance, at: { x: number; y: number }): NodeInstance[] {
  return def.children.map((child) => {
    const clone = cloneWithNewIds(child)
    return { ...clone, layout: { ...clone.layout, x: clone.layout.x + at.x, y: clone.layout.y + at.y } }
  })
}
