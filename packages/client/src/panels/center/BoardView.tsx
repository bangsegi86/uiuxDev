import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Board, BoardElement, BoardItem, Screen } from '@uiux/shared'
import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'
import { renderStaticTree } from '../../componentRegistry'
import { AddScreenModal } from './AddScreenModal'
import { api } from '../../lib/apiClient'

/**
 * Scaled static preview of a screen. Memoized on the screen reference so moving
 * board items (which doesn't change a screen) never re-renders every preview's
 * full node tree — important for boards holding many screens.
 */
const ScreenPreview = memo(function ScreenPreview({ screen, scale }: { screen: Screen; scale: number }) {
  return (
    <div
      className="board-frame-preview"
      style={{ width: screen.canvas.width, height: screen.canvas.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
    >
      {screen.root.children.map(renderStaticTree)}
    </div>
  )
})

const SCALE = 0.26

type Drag =
  | { mode: 'none' }
  | { mode: 'item'; screenId: string; offX: number; offY: number }
  | { mode: 'element'; id: string; offX: number; offY: number }
  | { mode: 'elementResize'; id: string; startX: number; startY: number; startW: number; startH: number }
  | { mode: 'connect'; from: string; x: number; y: number }

interface Ctx {
  x: number
  y: number
  screenId: string
}

function itemBox(item: BoardItem, screen: Screen | undefined) {
  const w = (screen?.canvas.width ?? 390) * SCALE
  const h = (screen?.canvas.height ?? 600) * SCALE
  return { x: item.x, y: item.y, w, h }
}

/** The flow board: screens placed as thumbnails, linked by connectors. */
export function BoardView({ board }: { board: Board }) {
  const { t } = useI18n()
  const projectId = useEditor((s) => s.projectId)
  const screens = useEditor((s) => s.screens)
  const dirty = useEditor((s) => Boolean(s.dirty[board.id]))
  const saving = useEditor((s) => s.saving)
  const moveBoardItem = useEditor((s) => s.moveBoardItem)
  const addConnector = useEditor((s) => s.addConnector)
  const updateConnector = useEditor((s) => s.updateConnector)
  const deleteConnector = useEditor((s) => s.deleteConnector)
  const removeScreenFromBoard = useEditor((s) => s.removeScreenFromBoard)
  const updateBoardElement = useEditor((s) => s.updateBoardElement)
  const removeBoardElement = useEditor((s) => s.removeBoardElement)
  const openScreen = useEditor((s) => s.openScreen)
  const saveActive = useEditor((s) => s.saveActive)
  const renameDoc = useEditor((s) => s.renameDoc)
  const autosave = useEditor((s) => s.autosave)
  const toggleAutosave = useEditor((s) => s.toggleAutosave)
  const boardRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag>({ mode: 'none' })
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const onRenameBoard = () => {
    const name = window.prompt(t.rename, board.name)
    if (name && name.trim()) void renameDoc({ kind: 'board', id: board.id }, name)
  }

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
    } else if (drag.mode === 'element') {
      updateBoardElement(board.id, drag.id, { x: Math.round(p.x - drag.offX), y: Math.round(p.y - drag.offY) })
    } else if (drag.mode === 'elementResize') {
      updateBoardElement(board.id, drag.id, {
        w: Math.max(60, Math.round(drag.startW + (p.x - drag.startX))),
        h: Math.max(40, Math.round(drag.startH + (p.y - drag.startY)))
      })
    } else if (drag.mode === 'connect') {
      setDrag({ ...drag, x: p.x, y: p.y })
    }
  }

  const onElementHeadDown = (e: ReactPointerEvent, el: BoardElement) => {
    e.stopPropagation()
    const p = toBoard(e.clientX, e.clientY)
    setDrag({ mode: 'element', id: el.id, offX: p.x - el.x, offY: p.y - el.y })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onElementResizeDown = (e: ReactPointerEvent, el: BoardElement) => {
    e.stopPropagation()
    const p = toBoard(e.clientX, e.clientY)
    setDrag({ mode: 'elementResize', id: el.id, startX: p.x, startY: p.y, startW: el.w, startH: el.h })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  /** Upload a picked image to the server, storing the returned URL (falls back
   *  to an inline data URL if the upload fails). */
  const onPickImage = (id: string, file: File | undefined | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = String(reader.result)
      try {
        if (!projectId) throw new Error('no project')
        const { url } = await api.uploadImage(projectId, dataUrl)
        updateBoardElement(board.id, id, { src: url })
      } catch {
        updateBoardElement(board.id, id, { src: dataUrl })
      }
    }
    reader.readAsDataURL(file)
  }

  const editConnectorLabel = (id: string, current: string) => {
    const v = window.prompt(t.connectorLabel, current)
    if (v !== null) updateConnector(board.id, id, { label: v })
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
        <strong className="screen-name" title={t.rename} onDoubleClick={onRenameBoard}>
          🗺 {board.name}
        </strong>
        <span className="divider-v" />
        <button onClick={() => setAddOpen(true)}>＋ {t.addScreenToBoard}</button>
        <span className="spacer" />
        <label className="autosave-toggle" title={t.autosaveHint}>
          <input type="checkbox" checked={autosave} onChange={toggleAutosave} /> {t.autosave}
        </label>
        <button className="primary" onClick={() => void saveActive()} disabled={saving}>
          {saving ? '…' : t.save}
        </button>
        <span className={`dirty-dot ${dirty ? 'on' : 'off'}`}>
          {saving ? t.saving : dirty ? (autosave ? t.autosavePending : t.unsaved) : t.saved}
        </span>
      </div>

      {addOpen && <AddScreenModal boardId={board.id} onClose={() => setAddOpen(false)} />}

      <div className="board-scroll">
        <div
          ref={boardRef}
          className="board"
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerDown={() => setCtx(null)}
        >
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
                  onDoubleClick={() => editConnectorLabel(c.id, c.label ?? '')}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (window.confirm(t.confirmDelete)) deleteConnector(board.id, c.id)
                  }}
                >
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12}>
                    <title>{t.connectorHintEdit}</title>
                  </line>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#64748b" strokeWidth={1.5} markerEnd="url(#arrow)" />
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 4}
                    className="board-connector-label"
                    onClick={() => editConnectorLabel(c.id, c.label ?? '')}
                  >
                    {c.label || '＋'}
                  </text>
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
                onContextMenu={(e) => {
                  e.preventDefault()
                  const p = toBoard(e.clientX, e.clientY)
                  setCtx({ x: p.x, y: p.y, screenId: item.screenId })
                }}
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
                  {screen && <ScreenPreview screen={screen} scale={SCALE} />}
                </div>
              </div>
            )
          })}

          {(board.elements ?? []).map((el) => (
            <div
              key={el.id}
              className={`board-el board-el-${el.kind}`}
              style={{ left: el.x, top: el.y, width: el.w, height: el.h, background: el.kind === 'memo' ? el.color : undefined }}
            >
              <div className="board-el-head" onPointerDown={(e) => onElementHeadDown(e, el)}>
                <span className="board-el-grip">⠿</span>
                <span className="spacer" />
                {(el.kind === 'memo' || el.kind === 'text') && (
                  <>
                    <button
                      className="board-el-tool"
                      title={t.fontSmaller}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => updateBoardElement(board.id, el.id, { fontSize: Math.max(8, (el.fontSize ?? 13) - 1) })}
                    >
                      A−
                    </button>
                    <button
                      className="board-el-tool"
                      title={t.fontLarger}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => updateBoardElement(board.id, el.id, { fontSize: Math.min(48, (el.fontSize ?? 13) + 1) })}
                    >
                      A+
                    </button>
                    <button
                      className="board-el-tool"
                      title={t.align}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() =>
                        updateBoardElement(board.id, el.id, {
                          align: el.align === 'left' || !el.align ? 'center' : el.align === 'center' ? 'right' : 'left'
                        })
                      }
                    >
                      {el.align === 'center' ? '↔' : el.align === 'right' ? '⇥' : '⇤'}
                    </button>
                  </>
                )}
                {el.kind === 'memo' && (
                  <input
                    className="board-el-color"
                    type="color"
                    title={t.memoColor}
                    value={el.color ?? '#fff8c5'}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => updateBoardElement(board.id, el.id, { color: e.target.value })}
                  />
                )}
                {el.kind === 'image' && (
                  <button
                    className="board-el-tool"
                    title={t.imageUrl}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      const v = window.prompt(t.imageUrl, el.src ?? '')
                      if (v !== null) updateBoardElement(board.id, el.id, { src: v })
                    }}
                  >
                    🔗
                  </button>
                )}
                <button className="board-frame-x" title={t.delete} onClick={() => removeBoardElement(board.id, el.id)}>
                  ×
                </button>
              </div>
              {el.kind === 'image' ? (
                el.src ? (
                  <img className="board-el-img" src={el.src} alt="" />
                ) : (
                  <label className="board-el-imgempty">
                    🖼 {t.uploadImage}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => onPickImage(el.id, e.target.files?.[0])}
                    />
                  </label>
                )
              ) : (
                <textarea
                  className="board-el-text"
                  style={{ fontSize: el.fontSize ?? 13, textAlign: el.align ?? 'left' }}
                  value={el.text ?? ''}
                  placeholder={t.editText}
                  onChange={(e) => updateBoardElement(board.id, el.id, { text: e.target.value })}
                />
              )}
              <div className="board-el-resize" onPointerDown={(e) => onElementResizeDown(e, el)} />
            </div>
          ))}

          {ctx && (
            <div className="board-context" style={{ left: ctx.x, top: ctx.y }} onPointerDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => {
                  void openScreen(ctx.screenId)
                  setCtx(null)
                }}
              >
                {t.openInEditor}
              </button>
              <button
                onClick={() => {
                  removeScreenFromBoard(board.id, ctx.screenId)
                  setCtx(null)
                }}
              >
                {t.removeFromBoard}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
