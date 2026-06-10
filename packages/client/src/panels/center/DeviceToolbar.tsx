import { selectSurface, useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'
import { downloadScreenHtml } from '../../lib/htmlExport'

export function DeviceToolbar() {
  const { t } = useI18n()
  const activeTab = useEditor((s) => s.activeTab)
  const screen = useEditor((s) => (s.activeTab?.kind === 'screen' ? s.screens[s.activeTab.id] : undefined))
  const surface = useEditor(selectSurface)
  const components = useEditor((s) => s.components)
  const setDevice = useEditor((s) => s.setDevice)
  const zoom = useEditor((s) => s.zoom)
  const setZoom = useEditor((s) => s.setZoom)
  const saving = useEditor((s) => s.saving)
  const dirty = useEditor((s) => (activeTab ? Boolean(s.dirty[activeTab.id]) : false))
  const saveActive = useEditor((s) => s.saveActive)

  if (!screen || !surface) return null

  return (
    <div className="toolbar">
      <strong className="screen-name">{screen.name}</strong>
      <span className="divider-v" />
      <span className="label">{t.device}</span>
      <div className="segmented">
        <button className={surface.device === 'pc' ? 'active' : ''} onClick={() => setDevice('pc')}>
          {t.pc}
        </button>
        <button className={surface.device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}>
          {t.mobile}
        </button>
      </div>
      <span className="divider-v" />
      <span className="label">{t.zoom}</span>
      <input type="range" min={0.25} max={1.5} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
      <span className="zoom-value">{Math.round(zoom * 100)}%</span>
      <span className="spacer" />
      <button onClick={() => downloadScreenHtml(screen, components)}>{t.exportHtml}</button>
      <button className="primary" onClick={() => void saveActive()} disabled={saving}>
        {saving ? '…' : t.save}
      </button>
      <span className={`dirty-dot ${dirty ? 'on' : 'off'}`}>{dirty ? t.unsaved : t.saved}</span>
    </div>
  )
}
