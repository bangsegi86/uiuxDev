import { useMemo, useState } from 'react'
import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'

/** Modal to add screens to a board: searchable grid with multi-select insert. */
export function AddScreenModal({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const { t } = useI18n()
  const tree = useEditor((s) => s.tree)
  const screens = useEditor((s) => s.screens)
  const board = useEditor((s) => s.boards[boardId])
  const addScreenToBoard = useEditor((s) => s.addScreenToBoard)

  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string[]>([])

  const onBoard = new Set(board?.items.map((i) => i.screenId) ?? [])

  const candidates = useMemo(
    () =>
      tree
        .filter((n) => n.type === 'screen' && n.screenId && !onBoard.has(n.screenId))
        .filter((n) => n.name.toLowerCase().includes(query.trim().toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tree, query, board]
  )

  const toggle = (screenId: string) =>
    setPicked((p) => (p.includes(screenId) ? p.filter((x) => x !== screenId) : [...p, screenId]))

  const onInsert = async () => {
    for (const id of picked) await addScreenToBoard(boardId, id)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box add-screen-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{t.addScreens}</strong>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <input
          className="modal-search"
          autoFocus
          placeholder={t.searchScreens}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="screen-grid">
          {candidates.length === 0 && <div className="empty-hint">{t.noScreensLeft}</div>}
          {candidates.map((n) => {
            const sc = screens[n.screenId!]
            const selected = picked.includes(n.screenId!)
            return (
              <button
                key={n.id}
                className={`screen-card${selected ? ' selected' : ''}`}
                onClick={() => toggle(n.screenId!)}
                onDoubleClick={() => void addScreenToBoard(boardId, n.screenId!).then(onClose)}
              >
                <span className="screen-card-icon">{sc?.device === 'pc' ? '🖥' : sc ? '📱' : '📄'}</span>
                <span className="screen-card-name">{n.name}</span>
                {selected && <span className="screen-card-check">✓</span>}
              </button>
            )
          })}
        </div>

        <div className="modal-foot">
          <span className="modal-count">
            {picked.length} {t.selected}
          </span>
          <span className="spacer" />
          <button onClick={onClose}>{t.cancel}</button>
          <button className="primary" disabled={!picked.length} onClick={() => void onInsert()}>
            {t.insert}
          </button>
        </div>
      </div>
    </div>
  )
}
