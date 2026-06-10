import { PRIMITIVES } from '@uiux/shared'
import { selectRoot, useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'
import type { DragPayload } from '../center/Canvas'

function setDrag(e: React.DragEvent, payload: DragPayload) {
  e.dataTransfer.setData('application/uiux', JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

export function ComponentPalette() {
  const { t } = useI18n()
  const canInsert = useEditor((s) => selectRoot(s) != null)
  const components = useEditor((s) => s.components)
  const insertPrimitive = useEditor((s) => s.insertPrimitive)
  const insertComponentInstance = useEditor((s) => s.insertComponentInstance)
  const deleteComponent = useEditor((s) => s.deleteComponent)
  const newComponent = useEditor((s) => s.newComponent)
  const editComponent = useEditor((s) => s.editComponent)

  return (
    <div className="left-tab-body">
      <div className="palette-section-title">{t.components}</div>
      <div className="palette-grid">
        {PRIMITIVES.map((p) => (
          <div
            key={p.type}
            className="palette-item"
            draggable
            onDragStart={(e) => setDrag(e, { kind: 'primitive', type: p.type })}
            onClick={() => canInsert && insertPrimitive(p.type, { x: 40, y: 40 })}
            title={p.label}
          >
            <span className="palette-icon">{p.icon}</span>
            <span className="palette-label">{p.label}</span>
          </div>
        ))}
      </div>

      <div className="palette-section-title">
        {t.myComponents}
        <button className="icon-btn" title={t.newComponent} onClick={newComponent}>
          ＋
        </button>
      </div>
      {components.length === 0 && <div className="empty-hint small">—</div>}
      <div className="palette-list">
        {components.map((c) => (
          <div
            key={c.id}
            className="palette-row"
            draggable
            onDragStart={(e) => setDrag(e, { kind: 'component', componentId: c.id })}
            onClick={() => canInsert && insertComponentInstance(c.id, { x: 40, y: 40 })}
          >
            <span className="palette-icon">▤</span>
            <span className="palette-label grow">{c.name}</span>
            <button
              className="icon-btn"
              title={t.editComponent}
              onClick={(e) => {
                e.stopPropagation()
                editComponent(c.id)
              }}
            >
              ✎
            </button>
            <button
              className="icon-btn"
              title={t.delete}
              onClick={(e) => {
                e.stopPropagation()
                void deleteComponent(c.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
