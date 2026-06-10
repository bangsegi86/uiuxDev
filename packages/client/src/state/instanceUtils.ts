import { nanoid } from 'nanoid'
import type { Layout, NodeInstance } from '@uiux/shared'

/**
 * The canvas works on a flat list of top-level instances (`root.children`),
 * each absolutely positioned. Custom components are expanded into primitives
 * on drop, so only primitive instances ever live on the canvas.
 */

export function findInstance(children: NodeInstance[], id: string): NodeInstance | undefined {
  return children.find((c) => c.id === id)
}

/** Deep-clone an instance subtree assigning fresh ids throughout. */
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

/** Bounding box around a set of instances. */
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
 * Build a custom-component definition from a set of selected instances:
 * a container sized to their bounding box, with the instances re-based to
 * coordinates relative to that box.
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
 * Expand a saved definition into fresh top-level instances positioned at a
 * drop point. Used when dropping a custom component or applying a template.
 */
export function expandDefinition(def: NodeInstance, at: { x: number; y: number }): NodeInstance[] {
  return def.children.map((child) => {
    const clone = cloneWithNewIds(child)
    return { ...clone, layout: { ...clone.layout, x: clone.layout.x + at.x, y: clone.layout.y + at.y } }
  })
}
