import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { isContainerType, isSpecEmpty, type ElementSpec, type Layout, type NodeInstance } from '@uiux/shared'
import { selectRoot, selectSurface, useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'
import { absoluteOrigin } from '../../state/tree'
import { sendCursor } from '../../lib/collabBus'
import { renderPrimitive, renderStaticTree } from '../../componentRegistry'

/** Stable per-user color derived from the user id. */
function userColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return `hsl(${h}, 70%, 45%)`
}

/** Drag payload format shared with the palette / component list. */
export interface DragPayload {
  kind: 'primitive' | 'component'
  type?: string
  componentId?: string
}

/** Live, read-only render of a linked custom-component instance, scaled to fit. */
function CustomInstanceView({ node }: { node: NodeInstance }) {
  const components = useEditor((s) => s.components)
  const comp = components.find((c) => c.id === node.type.slice('custom:'.length))
  if (!comp) return <div className="missing-component">?</div>
  const def = comp.definition
  const sx = node.layout.w / (def.layout.w || 1)
  const sy = node.layout.h / (def.layout.h || 1)
  return (
    <div
      className="custom-instance"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: def.layout.w,
        height: def.layout.h,
        transform: `scale(${sx}, ${sy})`,
        transformOrigin: 'top left',
        pointerEvents: 'none'
      }}
    >
      {def.children.map(renderStaticTree)}
    </div>
  )
}

type Interaction =
  | { mode: 'idle' }
  | { mode: 'move'; startX: number; startY: number; origin: Record<string, Layout>; singleId?: string }
  | { mode: 'resize'; id: string; handle: string; startX: number; startY: number; origin: Layout }
  | { mode: 'marquee'; startX: number; startY: number; x: number; y: number }

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

export function Canvas() {
  const { t } = useI18n()
  const root = useEditor(selectRoot)
  const surface = useEditor(useShallow(selectSurface))
  const selection = useEditor((s) => s.selection)
  const zoom = useEditor((s) => s.zoom)
  const setSelection = useEditor((s) => s.setSelection)
  const toggleSelection = useEditor((s) => s.toggleSelection)
  const updateLayout = useEditor((s) => s.updateLayout)
  const insertPrimitive = useEditor((s) => s.insertPrimitive)
  const insertComponentInstance = useEditor((s) => s.insertComponentInstance)
  const reparent = useEditor((s) => s.reparent)
  const checkpoint = useEditor((s) => s.checkpoint)
  const remoteCursors = useEditor((s) => s.remoteCursors)

  const frameRef = useRef<HTMLDivElement>(null)
  const lastCursorSent = useRef(0)
  const [it, setIt] = useState<Interaction>({ mode: 'idle' })

  if (!root || !surface) return null
  const { width, height } = surface

  /** Convert a client point to canvas-space (root frame) coordinates. */
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
    const collect = (n: NodeInstance) => {
      if (sel.includes(n.id)) origin[n.id] = { ...n.layout }
      n.children.forEach(collect)
    }
    root.children.forEach(collect)
    checkpoint()
    setIt({ mode: 'move', startX: x, startY: y, origin, singleId: sel.length === 1 ? node.id : undefined })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onResizePointerDown = (e: ReactPointerEvent, node: NodeInstance, handle: string) => {
    e.stopPropagation()
    setSelection([node.id])
    const { x, y } = toCanvas(e.clientX, e.clientY)
    checkpoint()
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
    // Broadcast the local cursor (throttled), even when not interacting.
    const now = performance.now()
    if (now - lastCursorSent.current > 40) {
      lastCursorSent.current = now
      const c = toCanvas(e.clientX, e.clientY)
      sendCursor(Math.round(c.x), Math.round(c.y))
    }
    if (it.mode === 'idle') return
    const { x, y } = toCanvas(e.clientX, e.clientY)
    if (it.mode === 'move') {
      // Relative-layout delta equals canvas delta at any nesting depth.
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
      const hit = root.children
        .filter(
          (c) =>
            c.layout.x < x2 &&
            c.layout.x + c.layout.w > x1 &&
            c.layout.y < y2 &&
            c.layout.y + c.layout.h > y1
        )
        .map((c) => c.id)
      setSelection(hit)
    } else if (it.mode === 'move' && it.singleId) {
      // Re-parent into the container the node now sits over (by its center).
      const cur = useEditor.getState().getRoot()
      if (cur) {
        const origin = absoluteOrigin(cur, it.singleId)
        const node = it.origin[it.singleId]
        if (origin && node) {
          reparent(it.singleId, { x: origin.x + node.w / 2, y: origin.y + node.h / 2 })
        }
      }
    }
    setIt({ mode: 'idle' })
  }

  const onDropInto = (e: React.DragEvent, parentId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const raw = e.dataTransfer.getData('application/uiux')
    if (!raw) return
    const payload = JSON.parse(raw) as DragPayload
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) / zoom)
    const y = Math.round((e.clientY - rect.top) / zoom)
    if (payload.kind === 'primitive' && payload.type) {
      insertPrimitive(payload.type, { x, y }, parentId)
    } else if (payload.kind === 'component' && payload.componentId) {
      insertComponentInstance(payload.componentId, { x, y }, parentId)
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

  const renderNode = (node: NodeInstance): React.ReactNode => {
    const selected = selection.includes(node.id)
    const isCustom = node.type.startsWith('custom:')
    const container = !isCustom && isContainerType(node.type)
    return (
      <div
        key={node.id}
        className={`canvas-item${selected ? ' selected' : ''}${isCustom ? ' custom' : ''}`}
        style={{ left: node.layout.x, top: node.layout.y, width: node.layout.w, height: node.layout.h }}
        onPointerDown={(e) => onItemPointerDown(e, node)}
        onDragOver={container ? (e) => e.preventDefault() : undefined}
        onDrop={container ? (e) => onDropInto(e, node.id) : undefined}
      >
        {isCustom ? (
          <CustomInstanceView node={node} />
        ) : (
          <div className="canvas-item-inner">{renderPrimitive(node)}</div>
        )}
        {!isSpecEmpty(node.props.spec as ElementSpec | undefined) && (
          <div className="spec-badge" title={t.hasDevSpec}>
            📄
          </div>
        )}
        {!isCustom && node.children.map(renderNode)}
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
  }

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
        onDrop={(e) => onDropInto(e, 'root')}
      >
        {root.children.map(renderNode)}
        {marquee && (
          <div
            className="marquee"
            style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
          />
        )}
        {Object.entries(remoteCursors).map(([id, c]) => {
          const color = userColor(id)
          return (
            <div key={id} className="remote-cursor" style={{ left: c.x, top: c.y }}>
              <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: 'block' }}>
                <path d="M2 2 L2 15 L6 11 L9 17 L11 16 L8 10 L14 10 Z" fill={color} stroke="#fff" strokeWidth="1" />
              </svg>
              <span className="remote-cursor-label" style={{ background: color }}>
                {c.email || 'user'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
