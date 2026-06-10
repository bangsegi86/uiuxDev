import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'

/** Collapsible design-reference notes at the bottom of the design area. */
export function NotesPanel() {
  const { t } = useI18n()
  const screen = useEditor((s) => s.screen)
  const notesOpen = useEditor((s) => s.notesOpen)
  const toggleNotes = useEditor((s) => s.toggleNotes)
  const setNotes = useEditor((s) => s.setNotes)
  const checkpoint = useEditor((s) => s.checkpoint)

  return (
    <div className={`notes-panel${notesOpen ? ' open' : ' collapsed'}`}>
      <button className="notes-header" onClick={toggleNotes}>
        <span className="chevron">{notesOpen ? '▾' : '▸'}</span>
        <span>{t.notes}</span>
      </button>
      {notesOpen && (
        <textarea
          className="notes-body"
          placeholder={t.notes}
          value={screen?.notes ?? ''}
          disabled={!screen}
          onFocus={checkpoint}
          onChange={(e) => setNotes(e.target.value)}
        />
      )}
    </div>
  )
}
