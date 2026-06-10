import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'

/** Tabs to switch between the frames in a document + the board/edit toggle. */
export function FrameTabs() {
  const { t } = useI18n()
  const doc = useEditor((s) => s.doc)
  const activeFrameId = useEditor((s) => s.activeFrameId)
  const view = useEditor((s) => s.view)
  const setActiveFrame = useEditor((s) => s.setActiveFrame)
  const addFrame = useEditor((s) => s.addFrame)
  const renameFrame = useEditor((s) => s.renameFrame)
  const deleteFrame = useEditor((s) => s.deleteFrame)
  const setView = useEditor((s) => s.setView)

  if (!doc) return null

  const onRename = (id: string, current: string) => {
    const name = window.prompt(t.promptScreenName, current)
    if (name) renameFrame(id, name.trim())
  }

  return (
    <div className="frame-tabs">
      <div className="frame-tabs-list">
        {doc.frames.map((f) => (
          <div
            key={f.id}
            className={`frame-tab${view === 'edit' && f.id === activeFrameId ? ' active' : ''}`}
            onClick={() => setActiveFrame(f.id)}
            onDoubleClick={() => onRename(f.id, f.name)}
            title={f.name}
          >
            <span className="frame-tab-device">{f.device === 'pc' ? '🖥' : '📱'}</span>
            <span className="frame-tab-name">{f.name}</span>
            {doc.frames.length > 1 && (
              <button
                className="frame-tab-x"
                title={t.delete}
                onClick={(e) => {
                  e.stopPropagation()
                  if (window.confirm(t.confirmDelete)) deleteFrame(f.id)
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button className="frame-tab-add" title={t.newScreen} onClick={() => addFrame('pc')}>
          ＋
        </button>
      </div>
      <span className="spacer" />
      <div className="segmented view-toggle">
        <button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}>
          {t.editView}
        </button>
        <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>
          {t.boardView}
        </button>
      </div>
    </div>
  )
}
