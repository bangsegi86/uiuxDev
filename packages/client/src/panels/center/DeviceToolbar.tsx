import { selectSurface, useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'
import { downloadFrameHtml } from '../../lib/htmlExport'

export function DeviceToolbar() {
  const { t } = useI18n()
  const doc = useEditor((s) => s.doc)
  const activeFrameId = useEditor((s) => s.activeFrameId)
  const surface = useEditor(selectSurface)
  const components = useEditor((s) => s.components)
  const setFrameDevice = useEditor((s) => s.setFrameDevice)
  const zoom = useEditor((s) => s.zoom)
  const setZoom = useEditor((s) => s.setZoom)
  const saving = useEditor((s) => s.saving)
  const dirty = useEditor((s) => s.dirty)
  const saveScreen = useEditor((s) => s.saveScreen)

  const frame = doc?.frames.find((f) => f.id === activeFrameId)
  if (!frame || !surface) return null

  return (
    <div className="toolbar">
      <strong className="screen-name">{frame.name}</strong>
      <span className="divider-v" />
      <span className="label">{t.device}</span>
      <div className="segmented">
        <button className={surface.device === 'pc' ? 'active' : ''} onClick={() => setFrameDevice('pc')}>
          {t.pc}
        </button>
        <button
          className={surface.device === 'mobile' ? 'active' : ''}
          onClick={() => setFrameDevice('mobile')}
        >
          {t.mobile}
        </button>
      </div>
      <span className="divider-v" />
      <span className="label">{t.zoom}</span>
      <input type="range" min={0.25} max={1.5} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
      <span className="zoom-value">{Math.round(zoom * 100)}%</span>
      <span className="spacer" />
      <button onClick={() => downloadFrameHtml(frame, components)}>{t.exportHtml}</button>
      <button className="primary" onClick={() => void saveScreen()} disabled={saving}>
        {saving ? '…' : t.save}
      </button>
      <span className={`dirty-dot ${dirty ? 'on' : 'off'}`}>{dirty ? t.unsaved : t.saved}</span>
    </div>
  )
}
