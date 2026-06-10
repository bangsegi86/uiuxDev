import { PRIMITIVES } from '@uiux/shared'
import { selectRoot, useEditor } from '../state/editorStore'
import { useI18n } from '../i18n/I18nContext'
import { Canvas, type DragPayload } from './center/Canvas'
import { AlignToolbar } from './center/AlignToolbar'
import { PropertyPanel } from './right/PropertyPanel'

function setDrag(e: React.DragEvent, payload: DragPayload) {
  e.dataTransfer.setData('application/uiux', JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

/** A dedicated, full-screen design surface for building/editing a component. */
export function ComponentEditor() {
  const { t } = useI18n()
  const draft = useEditor((s) => s.componentDraft)
  const root = useEditor(selectRoot)
  const setDraftName = useEditor((s) => s.setDraftName)
  const insertPrimitive = useEditor((s) => s.insertPrimitive)
  const updateLayout = useEditor((s) => s.updateLayout)
  const closeComponentEditor = useEditor((s) => s.closeComponentEditor)
  const saveComponentDraft = useEditor((s) => s.saveComponentDraft)

  if (!draft || !root) return null

  return (
    <div className="component-editor">
      <header className="ce-header">
        <span className="ce-title">🧩 {t.componentEditor}</span>
        <input
          className="ce-name"
          placeholder={t.promptComponentName}
          value={draft.name}
          onChange={(e) => setDraftName(e.target.value)}
        />
        <span className="label">{t.size}</span>
        <input
          className="ce-size"
          type="number"
          value={Math.round(root.layout.w)}
          onChange={(e) => updateLayout('root', { w: Number(e.target.value) })}
        />
        <span>×</span>
        <input
          className="ce-size"
          type="number"
          value={Math.round(root.layout.h)}
          onChange={(e) => updateLayout('root', { h: Number(e.target.value) })}
        />
        <span className="spacer" />
        <button onClick={closeComponentEditor}>{t.cancel}</button>
        <button className="primary" onClick={() => void saveComponentDraft()}>
          {t.save}
        </button>
      </header>

      <div className="ce-body">
        <aside className="panel left-panel">
          <div className="panel-title">{t.components}</div>
          <div className="left-tab-body">
            <div className="palette-grid">
              {PRIMITIVES.map((p) => (
                <div
                  key={p.type}
                  className="palette-item"
                  draggable
                  onDragStart={(e) => setDrag(e, { kind: 'primitive', type: p.type })}
                  onClick={() => insertPrimitive(p.type, { x: 24, y: 24 })}
                  title={p.label}
                >
                  <span className="palette-icon">{p.icon}</span>
                  <span className="palette-label">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="center-panel">
          <AlignToolbar />
          <div className="canvas-area">
            <Canvas />
          </div>
        </main>

        <PropertyPanel />
      </div>
    </div>
  )
}
