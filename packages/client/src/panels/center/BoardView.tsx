import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Frame } from '@uiux/shared'
import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'
import { renderStaticTree } from '../../componentRegistry'

const SCALE = 0.26

type Drag =
  | { mode: 'none' }
  | { mode: 'frame'; id: string; offX: number; offY: number }
  | { mode: 'connect'; from: string; x: number; y: number }

function frameBox(f: Frame) {
  return { x: f.board.x, y: f.board.y, w: f.canvas.width * SCALE, h: f.canvas.height * SCALE }
}

/** The flow board: frames laid out as thumbnails with flow connectors. */
export function BoardView() {
  const { t } = useI18n()
  const doc = useEditor((s) => s.doc)
  const moveFrameOnBoard = useEditor((s) => s.moveFrameOnBoard)
  const addConnector = useEditor((s) => s.addConnector)
  const deleteConnector = useEditor((s) => s.deleteConnector)
  const setActiveFrame = useEditor((s) => s.setActiveFrame)
  const boardRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag>({ mode: 'none' })

  if (!doc) return null

  const toBoard = (clientX: number, clientY: number) => {
    const rect = boardRef.current!.getBoundingClientRect()
    return { x: clientX - rect.left + boardRef.current!.scrollLeft, y: clientY - rect.top + boardRef.current!.scrollTop }
  }

  const onFrameDown = (e: ReactPointerEvent, f: Frame) => {
    if ((e.target as HTMLElement).closest('.board-connect-handle')) return
    const p = toBoard(e.clientX, e.clientY)
    setDrag({ mode: 'frame', id: f.id, offX: p.x - f.board.x, offY: p.y - f.board.y })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onConnectDown = (e: ReactPointerEvent, f: Frame) => {
    e.stopPropagation()
    const p = toBoard(e.clientX, e.clientY)
    setDrag({ mode: 'connect', from: f.id, x: p.x, y: p.y })
  }

  const onMove = (e: ReactPointerEvent) => {
    if (drag.mode === 'none') return
    const p = toBoard(e.clientX, e.clientY)
    if (drag.mode === 'frame') {
      moveFrameOnBoard(drag.id, Math.round(p.x - drag.offX), Math.round(p.y - drag.offY))
    } else if (drag.mode === 'connect') {
      setDrag({ ...drag, x: p.x, y: p.y })
    }
  }

  const onUp = (e: ReactPointerEvent) => {
    if (drag.mode === 'connect') {
      const target = (e.target as HTMLElement).closest('[data-frame-id]') as HTMLElement | null
      const toId = target?.dataset.frameId
      if (toId && toId !== drag.from) addConnector(drag.from, toId)
    }
    setDrag({ mode: 'none' })
  }

  const center = (f: Frame) => {
    const b = frameBox(f)
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  }

  return (
    <div className="board-scroll">
      <div
        ref={boardRef}
        className="board"
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <svg className="board-svg">
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#64748b" />
            </marker>
          </defs>
          {doc.connectors.map((c) => {
            const from = doc.frames.find((f) => f.id === c.from)
            const to = doc.frames.find((f) => f.id === c.to)
            if (!from || !to) return null
            const a = center(from)
            const b = center(to)
            return (
              <g key={c.id} className="board-connector" onClick={() => { if (window.confirm(t.confirmDelete)) deleteConnector(c.id) }}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12} />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#64748b" strokeWidth={1.5} markerEnd="url(#arrow)" />
                {c.label && (
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} className="board-connector-label">
                    {c.label}
                  </text>
                )}
              </g>
            )
          })}
          {drag.mode === 'connect' && (() => {
            const from = doc.frames.find((f) => f.id === drag.from)!
            const a = center(from)
            return <line x1={a.x} y1={a.y} x2={drag.x} y2={drag.y} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#arrow)" />
          })()}
        </svg>

        {doc.frames.map((f) => {
          const b = frameBox(f)
          return (
            <div
              key={f.id}
              data-frame-id={f.id}
              className="board-frame"
              style={{ left: b.x, top: b.y, width: b.w }}
              onPointerDown={(e) => onFrameDown(e, f)}
              onDoubleClick={() => setActiveFrame(f.id)}
            >
              <div className="board-frame-head">
                <span className="frame-tab-device">{f.device === 'pc' ? '🖥' : '📱'}</span>
                <span className="board-frame-name">{f.name}</span>
                <button
                  className="board-connect-handle"
                  title={t.connect}
                  onPointerDown={(e) => onConnectDown(e, f)}
                >
                  →
                </button>
              </div>
              <div className="board-frame-canvas" style={{ width: b.w, height: b.h }}>
                <div
                  className="board-frame-preview"
                  style={{
                    width: f.canvas.width,
                    height: f.canvas.height,
                    transform: `scale(${SCALE})`,
                    transformOrigin: 'top left'
                  }}
                >
                  {f.root.children.map(renderStaticTree)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
