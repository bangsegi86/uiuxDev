import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'

/** Collapsible design-reference notes at the bottom of the design area. */
export function NotesPanel() {
  const { t } = useI18n()
  const doc = useEditor((s) => s.doc)
  const notesOpen = useEditor((s) => s.notesOpen)
  const toggleNotes = useEditor((s) => s.toggleNotes)
  const setNotes = useEditor((s) => s.setNotes)

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
          value={doc?.notes ?? ''}
          disabled={!doc}
          onChange={(e) => setNotes(e.target.value)}
        />
      )}
    </div>
  )
}
