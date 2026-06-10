import { selectRoot, useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'

/** Library of reusable whole-screen designs ("자주 쓰는 화면 디자인"). */
export function TemplateLibrary() {
  const { t } = useI18n()
  const hasSurface = useEditor((s) => selectRoot(s) != null)
  const templates = useEditor((s) => s.templates)
  const saveAsTemplate = useEditor((s) => s.saveAsTemplate)
  const applyTemplate = useEditor((s) => s.applyTemplate)
  const deleteTemplate = useEditor((s) => s.deleteTemplate)

  const onSave = async () => {
    if (!hasSurface) return
    const name = window.prompt(t.promptTemplateName, '')
    if (!name) return
    await saveAsTemplate(name.trim())
  }

  return (
    <div className="left-tab-body">
      <div className="palette-section-title">
        {t.templates}
        <button className="icon-btn" title={t.saveAsTemplate} disabled={!hasSurface} onClick={() => void onSave()}>
          ＋
        </button>
      </div>
      {templates.length === 0 && <div className="empty-hint small">—</div>}
      <div className="palette-list">
        {templates.map((tpl) => (
          <div key={tpl.id} className="template-row">
            <span className="palette-icon">🗂</span>
            <span className="palette-label grow">{tpl.name}</span>
            <span className="badge">{tpl.device === 'pc' ? t.pc : t.mobile}</span>
            <button
              className="icon-btn"
              title={t.applyTemplate}
              disabled={!hasSurface}
              onClick={() => applyTemplate(tpl)}
            >
              ↧
            </button>
            <button className="icon-btn" title={t.delete} onClick={() => void deleteTemplate(tpl.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
