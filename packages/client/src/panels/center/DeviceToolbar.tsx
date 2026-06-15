import { useShallow } from 'zustand/react/shallow'
import { selectSurface, useEditor } from '../../state/editorStore'
import { dialog } from '../../state/dialogStore'
import { useI18n } from '../../i18n/I18nContext'
import { downloadScreenHtml } from '../../lib/htmlExport'
import { downloadScreenSpecSheet } from '../../lib/specSheet'

export function DeviceToolbar() {
  const { t } = useI18n()
  const activeTab = useEditor((s) => s.activeTab)
  const screen = useEditor((s) => (s.activeTab?.kind === 'screen' ? s.screens[s.activeTab.id] : undefined))
  const surface = useEditor(useShallow(selectSurface))
  const components = useEditor((s) => s.components)
  const setDevice = useEditor((s) => s.setDevice)
  const setCanvasSize = useEditor((s) => s.setCanvasSize)
  const checkpoint = useEditor((s) => s.checkpoint)
  const zoom = useEditor((s) => s.zoom)
  const setZoom = useEditor((s) => s.setZoom)
  const saving = useEditor((s) => s.saving)
  const dirty = useEditor((s) => (activeTab ? Boolean(s.dirty[activeTab.id]) : false))
  const saveActive = useEditor((s) => s.saveActive)
  const renameDoc = useEditor((s) => s.renameDoc)
  const autosave = useEditor((s) => s.autosave)
  const toggleAutosave = useEditor((s) => s.toggleAutosave)
  const ui = useEditor((s) => s.ui)
  const toggleUi = useEditor((s) => s.toggleUi)

  if (!screen || !surface) return null

  const onRename = async () => {
    const name = await dialog.prompt(t.rename, screen.name)
    if (name && name.trim() && activeTab) void renameDoc(activeTab, name)
  }

  return (
    <div className="toolbar">
      <strong className="screen-name" title={t.rename} onDoubleClick={onRename}>
        {screen.name}
      </strong>
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
      <span className="label">{t.size}</span>
      <input
        className="size-input"
        type="number"
        title={t.width}
        value={screen.canvas.width}
        onFocus={checkpoint}
        onChange={(e) => setCanvasSize(Number(e.target.value), screen.canvas.height)}
      />
      <span className="size-x">×</span>
      <input
        className="size-input"
        type="number"
        title={t.height}
        value={screen.canvas.height}
        onFocus={checkpoint}
        onChange={(e) => setCanvasSize(screen.canvas.width, Number(e.target.value))}
      />
      <span className="divider-v" />
      <div className="segmented">
        <button className={ui.ruler ? 'active' : ''} onClick={() => toggleUi('ruler')} title={t.ruler}>
          📏
        </button>
        <button className={ui.grid ? 'active' : ''} onClick={() => toggleUi('grid')} title={t.gridLines}>
          ▦
        </button>
        <button className={ui.guides ? 'active' : ''} onClick={() => toggleUi('guides')} title={t.guides}>
          ╋
        </button>
      </div>
      <span className="divider-v" />
      <span className="label">{t.zoom}</span>
      <input type="range" min={0.25} max={1.5} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
      <span className="zoom-value">{Math.round(zoom * 100)}%</span>
      <span className="spacer" />
      <button onClick={() => downloadScreenHtml(screen, components)}>{t.exportHtml}</button>
      <button onClick={() => downloadScreenSpecSheet(screen, components)}>{t.specSheet}</button>
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
  )
}
