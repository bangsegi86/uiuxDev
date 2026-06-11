import { memo, useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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

/** Stable interaction handlers shared with every node (kept off the render path). */
interface NodeHandlers {
  onItemPointerDown: (e: ReactPointerEvent, node: NodeInstance) => void
  onResizePointerDown: (e: ReactPointerEvent, node: NodeInstance, handle: string) => void
  onDropInto: (e: React.DragEvent, parentId: string) => void
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

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

/**
 * One placed node. Memoized on its `node` reference and the (stable) handler
 * bag, and it self-subscribes to its own selection state. So moving/resizing a
 * node only re-renders that node and its ancestors (the immutable-update path),
 * not the whole tree — which keeps large screens responsive during drags.
 */
const NodeView = memo(function NodeView({ node, handlers }: { node: NodeInstance; handlers: NodeHandlers }) {
  const { t } = useI18n()
  const selected = useEditor((s) => s.selection.includes(node.id))
  const showHandles = useEditor((s) => s.selection.length === 1 && s.selection[0] === node.id)
  const isCustom = node.type.startsWith('custom:')
  const container = !isCustom && isContainerType(node.type)
  return (
    <div
      className={`canvas-item${selected ? ' selected' : ''}${isCustom ? ' custom' : ''}`}
      style={{ left: node.layout.x, top: node.layout.y, width: node.layout.w, height: node.layout.h }}
      onPointerDown={(e) => handlers.onItemPointerDown(e, node)}
      onDragOver={container ? (e) => e.preventDefault() : undefined}
      onDrop={container ? (e) => handlers.onDropInto(e, node.id) : undefined}
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
      {!isCustom && node.children.map((c) => <NodeView key={c.id} node={c} handlers={handlers} />)}
      {showHandles &&
        HANDLES.map((h) => (
          <div
            key={h}
            className={`resize-handle handle-${h}`}
            onPointerDown={(e) => handlers.onResizePointerDown(e, node, h)}
          />
        ))}
    </div>
  )
})

type Interaction =
  | { mode: 'idle' }
  | { mode: 'move'; startX: number; startY: number; origin: Record<string, Layout>; singleId?: string }
  | { mode: 'resize'; id: string; handle: string; startX: number; startY: number; origin: Layout }
  | { mode: 'marquee'; startX: number; startY: number; x: number; y: number }

export function Canvas() {
  const root = useEditor(selectRoot)
  const surface = useEditor(useShallow(selectSurface))
  const zoom = useEditor((s) => s.zoom)
  const remoteCursors = useEditor((s) => s.remoteCursors)

  const frameRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const lastCursorSent = useRef(0)
  const itRef = useRef<Interaction>({ mode: 'idle' })
  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  /** Client point → canvas-space (root frame) coordinates. Stable. */
  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = frameRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left) / zoomRef.current, y: (clientY - rect.top) / zoomRef.current }
  }, [])

  const onItemPointerDown = useCallback(
    (e: ReactPointerEvent, node: NodeInstance) => {
      e.stopPropagation()
      const st = useEditor.getState()
      let sel = st.selection
      if (e.shiftKey) {
        st.toggleSelection(node.id)
        sel = sel.includes(node.id) ? sel.filter((x) => x !== node.id) : [...sel, node.id]
      } else if (!sel.includes(node.id)) {
        st.setSelection([node.id])
        sel = [node.id]
      }
      const { x, y } = toCanvas(e.clientX, e.clientY)
      const origin: Record<string, Layout> = {}
      const collect = (n: NodeInstance) => {
        if (sel.includes(n.id)) origin[n.id] = { ...n.layout }
        n.children.forEach(collect)
      }
      st.getRoot()?.children.forEach(collect)
      st.checkpoint()
      itRef.current = { mode: 'move', startX: x, startY: y, origin, singleId: sel.length === 1 ? node.id : undefined }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [toCanvas]
  )

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent, node: NodeInstance, handle: string) => {
      e.stopPropagation()
      const st = useEditor.getState()
      st.setSelection([node.id])
      const { x, y } = toCanvas(e.clientX, e.clientY)
      st.checkpoint()
      itRef.current = { mode: 'resize', id: node.id, handle, startX: x, startY: y, origin: { ...node.layout } }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [toCanvas]
  )

  const onDropInto = useCallback((e: React.DragEvent, parentId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const raw = e.dataTransfer.getData('application/uiux')
    if (!raw) return
    const payload = JSON.parse(raw) as DragPayload
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) / zoomRef.current)
    const y = Math.round((e.clientY - rect.top) / zoomRef.current)
    const st = useEditor.getState()
    if (payload.kind === 'primitive' && payload.type) st.insertPrimitive(payload.type, { x, y }, parentId)
    else if (payload.kind === 'component' && payload.componentId) st.insertComponentInstance(payload.componentId, { x, y }, parentId)
  }, [])

  const handlers = useMemo<NodeHandlers>(
    () => ({ onItemPointerDown, onResizePointerDown, onDropInto }),
    [onItemPointerDown, onResizePointerDown, onDropInto]
  )

  if (!root || !surface) return null
  const { width, height } = surface

  const onCanvasPointerDown = (e: ReactPointerEvent) => {
    if (e.target !== frameRef.current) return
    useEditor.getState().setSelection([])
    const { x, y } = toCanvas(e.clientX, e.clientY)
    itRef.current = { mode: 'marquee', startX: x, startY: y, x, y }
    setMarquee({ left: x, top: y, width: 0, height: 0 })
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    // Broadcast the local cursor (throttled), even when not interacting.
    const now = performance.now()
    if (now - lastCursorSent.current > 40) {
      lastCursorSent.current = now
      const c = toCanvas(e.clientX, e.clientY)
      sendCursor(Math.round(c.x), Math.round(c.y))
    }
    const it = itRef.current
    if (it.mode === 'idle') return
    const { x, y } = toCanvas(e.clientX, e.clientY)
    const st = useEditor.getState()
    if (it.mode === 'move') {
      const dx = x - it.startX
      const dy = y - it.startY
      for (const id of Object.keys(it.origin)) {
        const o = it.origin[id]
        st.updateLayout(id, { x: Math.round(o.x + dx), y: Math.round(o.y + dy) })
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
      st.updateLayout(it.id, { x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) })
    } else if (it.mode === 'marquee') {
      itRef.current = { ...it, x, y }
      setMarquee({
        left: Math.min(it.startX, x),
        top: Math.min(it.startY, y),
        width: Math.abs(x - it.startX),
        height: Math.abs(y - it.startY)
      })
    }
  }

  const onPointerUp = () => {
    const it = itRef.current
    const st = useEditor.getState()
    if (it.mode === 'marquee') {
      const x1 = Math.min(it.startX, it.x)
      const y1 = Math.min(it.startY, it.y)
      const x2 = Math.max(it.startX, it.x)
      const y2 = Math.max(it.startY, it.y)
      const cur = st.getRoot()
      const hit = (cur?.children ?? [])
        .filter((c) => c.layout.x < x2 && c.layout.x + c.layout.w > x1 && c.layout.y < y2 && c.layout.y + c.layout.h > y1)
        .map((c) => c.id)
      st.setSelection(hit)
      setMarquee(null)
    } else if (it.mode === 'move' && it.singleId) {
      // Re-parent into the container the node now sits over (by its center).
      const cur = st.getRoot()
      if (cur) {
        const origin = absoluteOrigin(cur, it.singleId)
        const node = it.origin[it.singleId]
        if (origin && node) st.reparent(it.singleId, { x: origin.x + node.w / 2, y: origin.y + node.h / 2 })
      }
    }
    itRef.current = { mode: 'idle' }
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
        {root.children.map((c) => (
          <NodeView key={c.id} node={c} handlers={handlers} />
        ))}
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
