import { getPrimitive, type PropField } from '@uiux/shared'
import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'

export function PropertyPanel() {
  const { t } = useI18n()
  const screen = useEditor((s) => s.screen)
  const selection = useEditor((s) => s.selection)
  const updateProp = useEditor((s) => s.updateProp)
  const updateStyle = useEditor((s) => s.updateStyle)
  const updateLayout = useEditor((s) => s.updateLayout)

  if (!screen || selection.length === 0) {
    return (
      <aside className="panel right-panel">
        <div className="panel-title">{t.properties}</div>
        <div className="empty-hint">{t.noSelection}</div>
      </aside>
    )
  }

  if (selection.length > 1) {
    return (
      <aside className="panel right-panel">
        <div className="panel-title">{t.properties}</div>
        <div className="empty-hint">
          {selection.length}
          {t.multiSelection}
        </div>
      </aside>
    )
  }

  const node = screen.root.children.find((c) => c.id === selection[0])
  if (!node) return <aside className="panel right-panel" />
  const def = getPrimitive(node.type)

  const renderField = (f: PropField) => {
    const current =
      f.target === 'props' ? (node.props[f.key] as string | boolean | undefined) : node.style[f.key]
    const onChange = (value: string | boolean) => {
      if (f.target === 'props') updateProp(node.id, f.key, value)
      else updateStyle(node.id, f.key, String(value))
    }
    return (
      <label className="field" key={f.key}>
        <span>{f.label}</span>
        {f.kind === 'textarea' ? (
          <textarea value={(current as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        ) : f.kind === 'color' ? (
          <input
            type="color"
            value={(current as string) || '#000000'}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : f.kind === 'number' ? (
          <input
            type="number"
            value={(current as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : f.kind === 'boolean' ? (
          <input
            type="checkbox"
            checked={Boolean(current)}
            onChange={(e) => onChange(e.target.checked)}
          />
        ) : f.kind === 'select' ? (
          <select value={(current as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={(current as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </label>
    )
  }

  const num = (v: number) => Math.round(v)

  return (
    <aside className="panel right-panel">
      <div className="panel-title">
        {t.properties} · {def?.label ?? node.type}
      </div>

      <div className="prop-group">
        <div className="prop-group-title">{t.position} / {t.size}</div>
        <div className="xy-grid">
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <label className="field inline" key={k}>
              <span>{k.toUpperCase()}</span>
              <input
                type="number"
                value={num(node.layout[k])}
                onChange={(e) => updateLayout(node.id, { [k]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="prop-group">
        <div className="prop-group-title">{t.content} / {t.style}</div>
        {def?.fields.map(renderField)}
      </div>
    </aside>
  )
}
