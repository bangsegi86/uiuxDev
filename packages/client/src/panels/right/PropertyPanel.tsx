import { useEffect, useState } from 'react'
import { getPrimitive, type NodeInstance, type PropField } from '@uiux/shared'
import { selectRoot, useEditor } from '../../state/editorStore'
import { findNode } from '../../state/tree'
import { rgbToHex, stripPx } from '../../lib/color'
import { useI18n } from '../../i18n/I18nContext'
import { ColorField } from './ColorField'
import { GridEditor } from './GridEditor'
import { SpecEditor } from './SpecEditor'

/**
 * Read the *effective* (currently rendered) style of the selected node from the
 * live DOM, so the panel can show the real applied value — e.g. the inherited
 * font size or a renderer's default colour — even when the property isn't
 * explicitly set on the node.
 */
function useEffectiveStyles(node: NodeInstance | undefined): Record<string, string> {
  const [eff, setEff] = useState<Record<string, string>>({})
  const id = node?.id
  const styleKey = JSON.stringify(node?.style ?? {})
  const propKey = JSON.stringify(node?.props ?? {})
  useEffect(() => {
    if (!id) return
    const host = document.querySelector(`[data-node-id="${id}"]`)
    const styled =
      (host?.querySelector('.canvas-item-inner')?.firstElementChild as HTMLElement | null) ??
      (host as HTMLElement | null)
    if (!styled) {
      setEff({})
      return
    }
    const cs = getComputedStyle(styled)
    setEff({
      fontSize: stripPx(cs.fontSize),
      fontWeight: cs.fontWeight === '700' ? 'bold' : cs.fontWeight === '400' ? 'normal' : cs.fontWeight,
      textAlign: cs.textAlign === 'start' ? 'left' : cs.textAlign === 'end' ? 'right' : cs.textAlign,
      borderRadius: stripPx(cs.borderTopLeftRadius),
      borderWidth: stripPx(cs.borderTopWidth),
      padding: stripPx(cs.paddingTop),
      color: rgbToHex(cs.color),
      background: rgbToHex(cs.backgroundColor),
      borderColor: rgbToHex(cs.borderTopColor)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, styleKey, propKey])
  return eff
}

export function PropertyPanel() {
  const { t } = useI18n()
  const root = useEditor(selectRoot)
  const selection = useEditor((s) => s.selection)
  const components = useEditor((s) => s.components)
  const updateProp = useEditor((s) => s.updateProp)
  const updateStyle = useEditor((s) => s.updateStyle)
  const updateLayout = useEditor((s) => s.updateLayout)
  const detachComponentInstance = useEditor((s) => s.detachComponentInstance)
  const checkpoint = useEditor((s) => s.checkpoint)

  const node = root && selection.length === 1 ? findNode(root, selection[0])?.node : undefined
  const eff = useEffectiveStyles(node)

  if (!root || selection.length === 0) {
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

  if (!node) return <aside className="panel right-panel" />

  // Linked custom-component instance: show its source + detach action.
  if (node.type.startsWith('custom:')) {
    const comp = components.find((c) => c.id === node.type.slice('custom:'.length))
    return (
      <aside className="panel right-panel">
        <div className="panel-title">{t.componentInstance}</div>
        <div className="prop-group">
          <div className="field">
            <span>{t.myComponents}</span>
            <strong>{comp?.name ?? '—'}</strong>
          </div>
          <div className="xy-grid">
            {(['x', 'y', 'w', 'h'] as const).map((k) => (
              <label className="field inline" key={k}>
                <span>{k.toUpperCase()}</span>
                <input
                  type="number"
                  value={Math.round(node.layout[k])}
                  onFocus={checkpoint}
                  onChange={(e) => updateLayout(node.id, { [k]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          <button className="detach-btn" onClick={() => detachComponentInstance(node.id)}>
            {t.detach}
          </button>
        </div>
      </aside>
    )
  }

  const def = getPrimitive(node.type)

  const renderField = (f: PropField) => {
    const current =
      f.target === 'props' ? (node.props[f.key] as string | boolean | undefined) : node.style[f.key]
    // Effective (currently-applied) value to surface when nothing is set yet.
    const effective = f.target === 'style' ? eff[f.key] ?? '' : ''
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
          <ColorField value={((current as string) || effective) ?? ''} onChange={onChange} />
        ) : f.kind === 'number' ? (
          <input
            type="number"
            value={(current as string) ?? ''}
            placeholder={effective}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : f.kind === 'boolean' ? (
          <input
            type="checkbox"
            checked={Boolean(current)}
            onChange={(e) => onChange(e.target.checked)}
          />
        ) : f.kind === 'select' ? (
          <select value={((current as string) || effective) ?? ''} onChange={(e) => onChange(e.target.value)}>
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
            placeholder={effective}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </label>
    )
  }

  const num = (v: number) => Math.round(v)

  return (
    <aside className="panel right-panel" onFocusCapture={checkpoint}>
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

      {def?.customEditor === 'grid' && (
        <div className="prop-group">
          <div className="prop-group-title">{t.grid}</div>
          <GridEditor node={node} updateProp={updateProp} checkpoint={checkpoint} />
        </div>
      )}

      <div className="prop-group">
        <div className="prop-group-title">{t.content} / {t.style}</div>
        {def?.fields.map(renderField)}
      </div>

      <div className="prop-group">
        <div className="prop-group-title">{t.devSpec}</div>
        <SpecEditor node={node} updateProp={updateProp} checkpoint={checkpoint} />
      </div>
    </aside>
  )
}
