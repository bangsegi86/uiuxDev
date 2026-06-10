import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Board, BoardItem, Screen } from '@uiux/shared'
import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'
import { renderStaticTree } from '../../componentRegistry'

const SCALE = 0.26

type Drag =
  | { mode: 'none' }
  | { mode: 'item'; screenId: string; offX: number; offY: number }
  | { mode: 'connect'; from: string; x: number; y: number }

function itemBox(item: BoardItem, screen: Screen | undefined) {
  const w = (screen?.canvas.width ?? 390) * SCALE
  const h = (screen?.canvas.height ?? 600) * SCALE
  return { x: item.x, y: item.y, w, h }
}

/** The flow board: screens placed as thumbnails, linked by connectors. */
export function BoardView({ board }: { board: Board }) {
  const { t } = useI18n()
  const screens = useEditor((s) => s.screens)
  const tree = useEditor((s) => s.tree)
  const dirty = useEditor((s) => Boolean(s.dirty[board.id]))
  const saving = useEditor((s) => s.saving)
  const moveBoardItem = useEditor((s) => s.moveBoardItem)
  const addConnector = useEditor((s) => s.addConnector)
  const deleteConnector = useEditor((s) => s.deleteConnector)
  const addScreenToBoard = useEditor((s) => s.addScreenToBoard)
  const removeScreenFromBoard = useEditor((s) => s.removeScreenFromBoard)
  const openScreen = useEditor((s) => s.openScreen)
  const saveActive = useEditor((s) => s.saveActive)
  const boardRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag>({ mode: 'none' })

  const onBoard = board.items.map((i) => i.screenId)
  const available = tree.filter((n) => n.type === 'screen' && n.screenId && !onBoard.includes(n.screenId))

  const toBoard = (clientX: number, clientY: number) => {
    const el = boardRef.current!
    const rect = el.getBoundingClientRect()
    return { x: clientX - rect.left + el.scrollLeft, y: clientY - rect.top + el.scrollTop }
  }

  const center = (item: BoardItem) => {
    const b = itemBox(item, screens[item.screenId])
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  }

  const onItemDown = (e: ReactPointerEvent, item: BoardItem) => {
    if ((e.target as HTMLElement).closest('.board-connect-handle')) return
    const p = toBoard(e.clientX, e.clientY)
    setDrag({ mode: 'item', screenId: item.screenId, offX: p.x - item.x, offY: p.y - item.y })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onConnectDown = (e: ReactPointerEvent, item: BoardItem) => {
    e.stopPropagation()
    const p = toBoard(e.clientX, e.clientY)
    setDrag({ mode: 'connect', from: item.screenId, x: p.x, y: p.y })
  }

  const onMove = (e: ReactPointerEvent) => {
    if (drag.mode === 'none') return
    const p = toBoard(e.clientX, e.clientY)
    if (drag.mode === 'item') {
      moveBoardItem(board.id, drag.screenId, Math.round(p.x - drag.offX), Math.round(p.y - drag.offY))
    } else if (drag.mode === 'connect') {
      setDrag({ ...drag, x: p.x, y: p.y })
    }
  }

  const onUp = (e: ReactPointerEvent) => {
    if (drag.mode === 'connect') {
      const target = (e.target as HTMLElement).closest('[data-screen-id]') as HTMLElement | null
      const toId = target?.dataset.screenId
      if (toId && toId !== drag.from) addConnector(board.id, drag.from, toId)
    }
    setDrag({ mode: 'none' })
  }

  return (
    <>
      <div className="toolbar">
        <strong className="screen-name">🗺 {board.name}</strong>
        <span className="divider-v" />
        <label className="label">{t.addScreenToBoard}</label>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) void addScreenToBoard(board.id, e.target.value)
          }}
        >
          <option value="">{available.length ? '—' : t.noScreensLeft}</option>
          {available.map((n) => (
            <option key={n.id} value={n.screenId}>
              {n.name}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <button className="primary" onClick={() => void saveActive()} disabled={saving}>
          {saving ? '…' : t.save}
        </button>
        <span className={`dirty-dot ${dirty ? 'on' : 'off'}`}>{dirty ? t.unsaved : t.saved}</span>
      </div>

      <div className="board-scroll">
        <div ref={boardRef} className="board" onPointerMove={onMove} onPointerUp={onUp}>
          <svg className="board-svg">
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                <path d="M0,0 L8,3 L0,6 Z" fill="#64748b" />
              </marker>
            </defs>
            {board.connectors.map((c) => {
              const from = board.items.find((i) => i.screenId === c.from)
              const to = board.items.find((i) => i.screenId === c.to)
              if (!from || !to) return null
              const a = center(from)
              const b = center(to)
              return (
                <g
                  key={c.id}
                  className="board-connector"
                  onClick={() => {
                    if (window.confirm(t.confirmDelete)) deleteConnector(board.id, c.id)
                  }}
                >
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
            {drag.mode === 'connect' &&
              (() => {
                const from = board.items.find((i) => i.screenId === drag.from)
                if (!from) return null
                const a = center(from)
                return (
                  <line x1={a.x} y1={a.y} x2={drag.x} y2={drag.y} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#arrow)" />
                )
              })()}
          </svg>

          {board.items.map((item) => {
            const screen = screens[item.screenId]
            const b = itemBox(item, screen)
            return (
              <div
                key={item.screenId}
                data-screen-id={item.screenId}
                className="board-frame"
                style={{ left: b.x, top: b.y, width: b.w }}
                onPointerDown={(e) => onItemDown(e, item)}
                onDoubleClick={() => void openScreen(item.screenId)}
              >
                <div className="board-frame-head">
                  <span className="frame-tab-device">{screen?.device === 'pc' ? '🖥' : '📱'}</span>
                  <span className="board-frame-name">{screen?.name ?? '…'}</span>
                  <button className="board-connect-handle" title={t.connect} onPointerDown={(e) => onConnectDown(e, item)}>
                    →
                  </button>
                  <button
                    className="board-frame-x"
                    title={t.removeFromBoard}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeScreenFromBoard(board.id, item.screenId)
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="board-frame-canvas" style={{ width: b.w, height: b.h }}>
                  {screen && (
                    <div
                      className="board-frame-preview"
                      style={{
                        width: screen.canvas.width,
                        height: screen.canvas.height,
                        transform: `scale(${SCALE})`,
                        transformOrigin: 'top left'
                      }}
                    >
                      {screen.root.children.map(renderStaticTree)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
