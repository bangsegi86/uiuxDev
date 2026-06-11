import { useEditor } from '../../state/editorStore'
import { dialog } from '../../state/dialogStore'
import { useI18n } from '../../i18n/I18nContext'

/** Friendly placeholder shown when no document is open (first-run guidance). */
export function CenterEmpty() {
  const { t } = useI18n()
  const projectId = useEditor((s) => s.projectId)
  const createProject = useEditor((s) => s.createProject)

  const onNewProject = async () => {
    const name = await dialog.prompt(t.promptProjectName)
    if (name && name.trim()) await createProject(name.trim())
  }

  return (
    <div className="center-empty">
      <div className="empty-illustration">◳</div>
      {projectId ? (
        <>
          <div className="empty-title">{t.emptyScreenTitle}</div>
          <div className="empty-sub">{t.emptyScreenSub}</div>
        </>
      ) : (
        <>
          <div className="empty-title">{t.emptyProjectTitle}</div>
          <div className="empty-sub">{t.emptyProjectSub}</div>
          <button className="primary empty-cta" onClick={() => void onNewProject()}>
            ＋ {t.newProject}
          </button>
        </>
      )}
    </div>
  )
}
