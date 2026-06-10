import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Layout, NodeInstance } from '@uiux/shared'
import { useEditor } from '../../state/editorStore'
import { renderPrimitive } from '../../componentRegistry'

/** Drag payload format shared with the palette / component list. */
export interface DragPayload {
  kind: 'primitive' | 'component'
  type?: string
  definition?: NodeInstance
}

type Interaction =
  | { mode: 'idle' }
  | { mode: 'move'; startX: number; startY: number; origin: Record<string, Layout> }
  | { mode: 'resize'; id: string; handle: string; startX: number; startY: number; origin: Layout }
  | { mode: 'marquee'; startX: number; startY: number; x: number; y: number }

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

export function Canvas() {
  const screen = useEditor((s) => s.screen)
  const selection = useEditor((s) => s.selection)
  const zoom = useEditor((s) => s.zoom)
  const setSelection = useEditor((s) => s.setSelection)
  const toggleSelection = useEditor((s) => s.toggleSelection)
  const updateLayout = useEditor((s) => s.updateLayout)
  const insertPrimitive = useEditor((s) => s.insertPrimitive)
  const insertDefinition = useEditor((s) => s.insertDefinition)

  const frameRef = useRef<HTMLDivElement>(null)
  const [it, setIt] = useState<Interaction>({ mode: 'idle' })

  if (!screen) return null
  const { width, height } = screen.canvas

  /** Convert a pointer event to canvas-space coordinates. */
  const toCanvas = (clientX: number, clientY: number) => {
    const rect = frameRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom }
  }

  const onItemPointerDown = (e: ReactPointerEvent, node: NodeInstance) => {
    e.stopPropagation()
    let sel = selection
    if (e.shiftKey) {
      toggleSelection(node.id)
      sel = selection.includes(node.id)
        ? selection.filter((x) => x !== node.id)
        : [...selection, node.id]
    } else if (!selection.includes(node.id)) {
      setSelection([node.id])
      sel = [node.id]
    }
    const { x, y } = toCanvas(e.clientX, e.clientY)
    const origin: Record<string, Layout> = {}
    for (const c of screen.root.children) if (sel.includes(c.id)) origin[c.id] = { ...c.layout }
    setIt({ mode: 'move', startX: x, startY: y, origin })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onResizePointerDown = (e: ReactPointerEvent, node: NodeInstance, handle: string) => {
    e.stopPropagation()
    setSelection([node.id])
    const { x, y } = toCanvas(e.clientX, e.clientY)
    setIt({ mode: 'resize', id: node.id, handle, startX: x, startY: y, origin: { ...node.layout } })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onCanvasPointerDown = (e: ReactPointerEvent) => {
    if (e.target !== frameRef.current) return
    setSelection([])
    const { x, y } = toCanvas(e.clientX, e.clientY)
    setIt({ mode: 'marquee', startX: x, startY: y, x, y })
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (it.mode === 'idle') return
    const { x, y } = toCanvas(e.clientX, e.clientY)
    if (it.mode === 'move') {
      const dx = x - it.startX
      const dy = y - it.startY
      for (const id of Object.keys(it.origin)) {
        const o = it.origin[id]
        updateLayout(id, { x: Math.round(o.x + dx), y: Math.round(o.y + dy) })
      }
    } else if (it.mode === 'resize') {
      const dx = x - it.startX
      const dy = y - it.startY
      const o = it.origin
      let { x: nx, y: ny, w: nw, h: nh } = o
      if (it.handle.includes('e')) nw = Math.max(8, o.w + dx)
      if (it.handle.includes('s')) nh = Math.max(8, o.h + dy)
      if (it.handle.includes('w')) {
        nw = Math.max(8, o.w - dx)
        nx = o.x + (o.w - nw)
      }
      if (it.handle.includes('n')) {
        nh = Math.max(8, o.h - dy)
        ny = o.y + (o.h - nh)
      }
      updateLayout(it.id, { x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) })
    } else if (it.mode === 'marquee') {
      setIt({ ...it, x, y })
    }
  }

  const onPointerUp = () => {
    if (it.mode === 'marquee') {
      const x1 = Math.min(it.startX, it.x)
      const y1 = Math.min(it.startY, it.y)
      const x2 = Math.max(it.startX, it.x)
      const y2 = Math.max(it.startY, it.y)
      const hit = screen.root.children
        .filter(
          (c) =>
            c.layout.x < x2 &&
            c.layout.x + c.layout.w > x1 &&
            c.layout.y < y2 &&
            c.layout.y + c.layout.h > y1
        )
        .map((c) => c.id)
      setSelection(hit)
    }
    setIt({ mode: 'idle' })
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/uiux')
    if (!raw) return
    const payload = JSON.parse(raw) as DragPayload
    const { x, y } = toCanvas(e.clientX, e.clientY)
    if (payload.kind === 'primitive' && payload.type) {
      insertPrimitive(payload.type, { x: Math.round(x), y: Math.round(y) })
    } else if (payload.kind === 'component' && payload.definition) {
      insertDefinition(payload.definition, { x: Math.round(x), y: Math.round(y) })
    }
  }

  const marquee =
    it.mode === 'marquee'
      ? {
          left: Math.min(it.startX, it.x),
          top: Math.min(it.startY, it.y),
          width: Math.abs(it.x - it.startX),
          height: Math.abs(it.y - it.startY)
        }
      : null

  return (
    <div className="canvas-scroll">
      <div
        ref={frameRef}
        className="canvas-frame"
        style={{ width, height, transform: `scale(${zoom})` }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {screen.root.children.map((node) => {
          const selected = selection.includes(node.id)
          return (
            <div
              key={node.id}
              className={`canvas-item${selected ? ' selected' : ''}`}
              style={{
                left: node.layout.x,
                top: node.layout.y,
                width: node.layout.w,
                height: node.layout.h
              }}
              onPointerDown={(e) => onItemPointerDown(e, node)}
            >
              <div className="canvas-item-inner">{renderPrimitive(node)}</div>
              {selected && selection.length === 1 &&
                HANDLES.map((h) => (
                  <div
                    key={h}
                    className={`resize-handle handle-${h}`}
                    onPointerDown={(e) => onResizePointerDown(e, node, h)}
                  />
                ))}
            </div>
          )
        })}
        {marquee && (
          <div
            className="marquee"
            style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
          />
        )}
      </div>
    </div>
  )
}
