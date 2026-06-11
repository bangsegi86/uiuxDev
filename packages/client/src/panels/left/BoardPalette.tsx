import type { BoardElementKind } from '@uiux/shared'
import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'

const ITEMS: { kind: BoardElementKind; icon: string; key: 'memoEl' | 'textEl' | 'imageEl' }[] = [
  { kind: 'memo', icon: '🗒', key: 'memoEl' },
  { kind: 'text', icon: '🅣', key: 'textEl' },
  { kind: 'image', icon: '🖼', key: 'imageEl' }
]

/** Board-only components: memo, text, image, plus the connector hint. */
export function BoardPalette() {
  const { t } = useI18n()
  const boardId = useEditor((s) => (s.activeTab?.kind === 'board' ? s.activeTab.id : null))
  const addBoardElement = useEditor((s) => s.addBoardElement)

  if (!boardId) return <div className="left-tab-body"><div className="empty-hint small">—</div></div>

  return (
    <div className="left-tab-body">
      <div className="palette-section-title">{t.boardComponents}</div>
      <div className="palette-grid">
        {ITEMS.map((it) => (
          <div
            key={it.kind}
            className="palette-item"
            onClick={() => addBoardElement(boardId, it.kind)}
            title={t[it.key]}
          >
            <span className="palette-icon">{it.icon}</span>
            <span className="palette-label">{t[it.key]}</span>
          </div>
        ))}
      </div>

      <div className="palette-section-title">{t.connect}</div>
      <div className="board-hint">{t.connectorHint}</div>
    </div>
  )
}
