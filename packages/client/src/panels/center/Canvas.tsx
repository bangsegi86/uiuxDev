import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { isContainerType, isSpecEmpty, type ElementSpec, type Layout, type NodeInstance } from '@uiux/shared'
import { selectGuides, selectRoot, selectSurface, useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'
import { absoluteOrigin, findNode } from '../../state/tree'
import { sendCursor } from '../../lib/collabBus'
import { renderPrimitive, renderStaticTree } from '../../componentRegistry'
import { Ruler } from './Ruler'

const RULER = 22

/** Stable per-user color derived from the user id. */
function userColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return `hsl(${h}, 70%, 45%)`
}

/** Bounding box (canvas coords) enclosing a set of placed items. */
function boundingBoxOf(items: { abs: { x: number; y: number }; layout: { w: number; h: number } }[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const it of items) {
    minX = Math.min(minX, it.abs.x)
    minY = Math.min(minY, it.abs.y)
    maxX = Math.max(maxX, it.abs.x + it.layout.w)
    maxY = Math.max(maxY, it.abs.y + it.layout.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
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
  const showHandles = useEditor((s) => s.selection.includes(node.id))
  const isCustom = node.type.startsWith('custom:')
  const container = !isCustom && isContainerType(node.type)
  return (
    <div
      data-node-id={node.id}
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

interface Box {
  x: number
  y: number
  w: number
  h: number
}
interface GroupOrigin {
  id: string
  abs: { x: number; y: number }
  layout: Layout
}

type Interaction =
  | { mode: 'idle' }
  | { mode: 'move'; startX: number; startY: number; origin: Record<string, Layout>; singleId?: string }
  | { mode: 'resize'; id: string; handle: string; startX: number; startY: number; origin: Layout }
  | { mode: 'groupResize'; handle: string; startX: number; startY: number; box: Box; origins: GroupOrigin[] }
  | { mode: 'guide'; axis: 'x' | 'y'; index: number }
  | { mode: 'marquee'; startX: number; startY: number; x: number; y: number }

export function Canvas() {
  const { t } = useI18n()
  const root = useEditor(selectRoot)
  const surface = useEditor(useShallow(selectSurface))
  const zoom = useEditor((s) => s.zoom)
  const remoteCursors = useEditor((s) => s.remoteCursors)
  const ui = useEditor(useShallow((s) => s.ui))
  const guides = useEditor(selectGuides)
  const removeGuide = useEditor((s) => s.removeGuide)

  const hostRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const lastCursorSent = useRef(0)
  const itRef = useRef<Interaction>({ mode: 'idle' })
  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  // Frame's top-left relative to the host, so the rulers can align their ticks.
  const [view, setView] = useState({ offX: 0, offY: 0 })

  const updateView = useCallback(() => {
    const host = hostRef.current
    const frame = frameRef.current
    if (!host || !frame) return
    const hr = host.getBoundingClientRect()
    const fr = frame.getBoundingClientRect()
    setView({ offX: fr.left - hr.left, offY: fr.top - hr.top })
  }, [])

  // Recompute ruler offsets when zoom, canvas size or ruler visibility change.
  useEffect(() => {
    const id = requestAnimationFrame(updateView)
    return () => cancelAnimationFrame(id)
  }, [zoom, surface?.width, surface?.height, ui.ruler, updateView])

  /** Client point → canvas-space (root frame) coordinates. Stable. */
  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = frameRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left) / zoomRef.current, y: (clientY - rect.top) / zoomRef.current }
  }, [])

  const onGuideDown = useCallback((e: ReactPointerEvent, axis: 'x' | 'y', index: number) => {
    e.stopPropagation()
    itRef.current = { mode: 'guide', axis, index }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
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
      const cur = st.getRoot()
      if (!cur) return
      const { x, y } = toCanvas(e.clientX, e.clientY)
      const sel = st.selection
      // When several nodes are selected, a handle on any of them resizes the
      // whole selection together (proportionally); otherwise just this node.
      if (sel.length > 1 && sel.includes(node.id)) {
        const origins: GroupOrigin[] = []
        for (const id of sel) {
          const abs = absoluteOrigin(cur, id)
          const f = findNode(cur, id)
          if (abs && f) origins.push({ id, abs, layout: { ...f.node.layout } })
        }
        if (origins.length >= 2) {
          st.checkpoint()
          itRef.current = { mode: 'groupResize', handle, startX: x, startY: y, box: boundingBoxOf(origins), origins }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          return
        }
      }
      st.setSelection([node.id])
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
    } else if (it.mode === 'groupResize') {
      const dx = x - it.startX
      const dy = y - it.startY
      const b = it.box
      // New bounding box, anchored at the edge/corner opposite the handle.
      let nx = b.x
      let ny = b.y
      let nw = b.w
      let nh = b.h
      if (it.handle.includes('e')) nw = Math.max(8, b.w + dx)
      if (it.handle.includes('s')) nh = Math.max(8, b.h + dy)
      if (it.handle.includes('w')) {
        nw = Math.max(8, b.w - dx)
        nx = b.x + (b.w - nw)
      }
      if (it.handle.includes('n')) {
        nh = Math.max(8, b.h - dy)
        ny = b.y + (b.h - nh)
      }
      const sx = b.w > 0 ? nw / b.w : 1
      const sy = b.h > 0 ? nh / b.h : 1
      for (const o of it.origins) {
        const newAbsX = nx + (o.abs.x - b.x) * sx
        const newAbsY = ny + (o.abs.y - b.y) * sy
        st.updateLayout(o.id, {
          x: Math.round(o.layout.x + (newAbsX - o.abs.x)),
          y: Math.round(o.layout.y + (newAbsY - o.abs.y)),
          w: Math.max(8, Math.round(o.layout.w * sx)),
          h: Math.max(8, Math.round(o.layout.h * sy))
        })
      }
    } else if (it.mode === 'guide') {
      st.moveGuide(it.axis, it.index, it.axis === 'x' ? Math.round(x) : Math.round(y))
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

  /** Click a ruler to drop a guide at that canvas coordinate. */
  const onRulerDown = (e: ReactPointerEvent, axis: 'x' | 'y') => {
    const fr = frameRef.current?.getBoundingClientRect()
    if (!fr) return
    const st = useEditor.getState()
    if (axis === 'x') {
      const cx = Math.round((e.clientX - fr.left) / zoom)
      if (cx >= 0 && cx <= width) st.addGuide('x', cx)
    } else {
      const cy = Math.round((e.clientY - fr.top) / zoom)
      if (cy >= 0 && cy <= height) st.addGuide('y', cy)
    }
  }

  return (
    <div className="canvas-host" ref={hostRef}>
      {ui.ruler && (
        <>
          <div className="ruler-corner" />
          <div className="ruler ruler-h" title={t.guides} onPointerDown={(e) => onRulerDown(e, 'x')}>
            <Ruler axis="x" length={width} zoom={zoom} offset={view.offX} size={RULER} />
          </div>
          <div className="ruler ruler-v" title={t.guides} onPointerDown={(e) => onRulerDown(e, 'y')}>
            <Ruler axis="y" length={height} zoom={zoom} offset={view.offY} size={RULER} />
          </div>
        </>
      )}
      <div
        className="canvas-scroll"
        ref={scrollRef}
        onScroll={updateView}
        style={ui.ruler ? { paddingTop: RULER + 40, paddingLeft: RULER + 40 } : undefined}
      >
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
          {ui.grid && <div className="canvas-grid" />}
          {root.children.map((c) => (
            <NodeView key={c.id} node={c} handlers={handlers} />
          ))}
          {ui.guides &&
            guides.x.map((gx, i) => (
              <div
                key={`gx${i}`}
                className="guide guide-v"
                style={{ left: gx }}
                onPointerDown={(e) => onGuideDown(e, 'x', i)}
                onDoubleClick={() => removeGuide('x', i)}
                title={t.guides}
              >
                <span className="guide-line" />
              </div>
            ))}
          {ui.guides &&
            guides.y.map((gy, i) => (
              <div
                key={`gy${i}`}
                className="guide guide-h"
                style={{ top: gy }}
                onPointerDown={(e) => onGuideDown(e, 'y', i)}
                onDoubleClick={() => removeGuide('y', i)}
                title={t.guides}
              >
                <span className="guide-line" />
              </div>
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
    </div>
  )
}
