import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { selectSurface, useEditor } from '../../state/editorStore'
import { dialog } from '../../state/dialogStore'
import { useI18n } from '../../i18n/I18nContext'
import { downloadScreenHtml } from '../../lib/htmlExport'
import { downloadScreenSpecSheet } from '../../lib/specSheet'

/**
 * Number input that lets you type freely and only commits (and clamps) on blur
 * or Enter — so a min-size clamp doesn't fight you mid-typing (e.g. clearing the
 * field to type "200" no longer snaps to the minimum after the first digit).
 */
function SizeBox({ value, title, onCommit }: { value: number; title: string; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const n = parseInt(draft, 10)
    if (Number.isFinite(n)) onCommit(n)
    else setDraft(String(value))
  }
  return (
    <input
      className="size-input"
      type="number"
      title={title}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        else if (e.key === 'Escape') setDraft(String(value))
      }}
    />
  )
}

export function DeviceToolbar() {
  const { t } = useI18n()
  const activeTab = useEditor((s) => s.activeTab)
  const screen = useEditor((s) => (s.activeTab?.kind === 'screen' ? s.screens[s.activeTab.id] : undefined))
  const surface = useEditor(useShallow(selectSurface))
  const components = useEditor((s) => s.components)
  const setDevice = useEditor((s) => s.setDevice)
  const setCanvasSize = useEditor((s) => s.setCanvasSize)
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
      <SizeBox value={screen.canvas.width} title={t.width} onCommit={(w) => setCanvasSize(w, screen.canvas.height)} />
      <span className="size-x">×</span>
      <SizeBox value={screen.canvas.height} title={t.height} onCommit={(h) => setCanvasSize(screen.canvas.width, h)} />
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
