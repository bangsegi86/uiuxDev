import type { CSSProperties } from 'react'
import type { NodeInstance } from '@uiux/shared'

/** Translate an instance's stored style map into React inline styles. */
function toCss(style: Record<string, string>): CSSProperties {
  const css: Record<string, string> = {}
  const pxKeys = new Set(['borderWidth', 'borderRadius', 'fontSize', 'padding'])
  for (const [k, v] of Object.entries(style)) {
    if (v === '' || v == null) continue
    css[k] = pxKeys.has(k) && /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v
  }
  // Render a visible border only when a width is set.
  if (css.borderWidth) css.border = `${css.borderWidth} solid ${css.borderColor ?? '#cccccc'}`
  return css as CSSProperties
}

const fill: CSSProperties = { width: '100%', height: '100%', boxSizing: 'border-box' }

/**
 * Render a node subtree statically (no interaction), used to display a linked
 * custom-component instance from its stored definition.
 */
export function renderStaticTree(node: NodeInstance): React.ReactNode {
  return (
    <div
      key={node.id}
      style={{
        position: 'absolute',
        left: node.layout.x,
        top: node.layout.y,
        width: node.layout.w,
        height: node.layout.h
      }}
    >
      <div style={{ width: '100%', height: '100%' }}>{renderPrimitive(node)}</div>
      {node.children.map(renderStaticTree)}
    </div>
  )
}

interface GridColumn {
  title: string
  width: number
  colSpan?: number
}

function renderGrid(node: NodeInstance): React.ReactNode {
  const columns = (node.props.columns as GridColumn[] | undefined) ?? []
  const rowCount = (node.props.rowCount as number | undefined) ?? 0
  const headers: React.ReactNode[] = []
  for (let i = 0; i < columns.length; ) {
    const span = Math.max(1, columns[i].colSpan ?? 1)
    headers.push(
      <th key={i} colSpan={span} style={{ border: '1px solid #cbd5e1', background: '#f1f5f9', padding: '4px 6px', fontWeight: 600 }}>
        {columns[i].title}
      </th>
    )
    i += span
  }
  return (
    <div style={{ ...fill, overflow: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, tableLayout: 'fixed' }}>
        <colgroup>
          {columns.map((c, i) => (
            <col key={i} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>{headers}</tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, r) => (
            <tr key={r}>
              {columns.map((_, c) => (
                <td key={c} style={{ border: '1px solid #e2e8f0', padding: '4px 6px', height: 24 }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderModal(node: NodeInstance, css: CSSProperties): React.ReactNode {
  const p = node.props as Record<string, string>
  const overlay = node.props.showOverlay !== false
  return (
    <div style={{ ...fill, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: overlay ? 'rgba(15,23,42,0.35)' : 'transparent' }}>
      <div style={{ ...css, minWidth: 0, width: '90%', maxHeight: '90%', background: css.background ?? '#fff', border: '1px solid #e2e8f0', borderRadius: css.borderRadius ?? 10, boxShadow: '0 8px 30px rgba(0,0,0,0.2)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>{p.title ?? 'Title'}</div>
        <div style={{ flex: 1, color: '#334155', whiteSpace: 'pre-wrap' }}>{p.message ?? ''}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {p.cancelText ? <button style={{ padding: '6px 12px' }}>{p.cancelText}</button> : null}
          <button style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>
            {p.confirmText ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Render the inner content of a primitive (the outer positioned box is the canvas's job). */
export function renderPrimitive(node: NodeInstance): React.ReactNode {
  const css = { ...fill, ...toCss(node.style) }
  const p = node.props as Record<string, string>

  switch (node.type) {
    case 'text':
      return <div style={{ ...css, display: 'flex', alignItems: 'center' }}>{p.text ?? 'Text'}</div>
    case 'button':
      return (
        <button style={{ ...css, cursor: 'default', background: css.background ?? '#2563eb', color: css.color ?? '#fff', border: css.border ?? 'none', borderRadius: css.borderRadius ?? 6 }}>
          {p.text ?? 'Button'}
        </button>
      )
    case 'input':
      return (
        <input
          readOnly
          placeholder={p.placeholder ?? ''}
          style={{ ...css, border: css.border ?? '1px solid #cbd5e1', borderRadius: css.borderRadius ?? 6, padding: css.padding ?? '0 8px' }}
        />
      )
    case 'image':
      return p.src ? (
        <img src={p.src} alt={p.alt ?? ''} style={{ ...css, objectFit: 'cover' }} />
      ) : (
        <div style={{ ...css, display: 'flex', alignItems: 'center', justifyContent: 'center', background: css.background ?? '#e2e8f0', color: '#64748b', fontSize: 12 }}>
          🖼 Image
        </div>
      )
    case 'checkbox':
      return (
        <label style={{ ...css, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={Boolean(node.props.checked)} readOnly />
          <span>
            {p.label ?? 'Checkbox'}
            {node.props.required ? <span style={{ color: '#dc2626' }}> *</span> : null}
          </span>
        </label>
      )
    case 'radio': {
      const opts = String(p.options ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      return (
        <div style={{ ...css, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {p.label ? (
            <div style={{ fontWeight: 600 }}>
              {p.label}
              {node.props.required ? <span style={{ color: '#dc2626' }}> *</span> : null}
            </div>
          ) : null}
          {opts.map((o) => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" readOnly checked={p.value === o} /> {o}
            </label>
          ))}
        </div>
      )
    }
    case 'calendar':
      return (
        <div style={{ ...css, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {p.label ? (
            <span style={{ fontSize: 11 }}>
              {p.label}
              {node.props.required ? <span style={{ color: '#dc2626' }}> *</span> : null}
            </span>
          ) : null}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #cbd5e1', borderRadius: 6, padding: '0 8px', background: node.props.readonly ? '#f1f5f9' : '#fff' }}>
            <span>📅</span>
            <span style={{ color: p.value ? '#0f172a' : '#94a3b8' }}>{p.value || p.placeholder || 'YYYY-MM-DD'}</span>
          </div>
        </div>
      )
    case 'grid':
      return renderGrid(node)
    case 'modal':
      return renderModal(node, css)
    case 'annotation':
      return (
        <div style={{ ...css, background: css.background ?? '#fff8c5', border: css.border ?? '1px solid #e3c000', borderRadius: css.borderRadius ?? 6, padding: css.padding ?? 8, fontSize: css.fontSize ?? 12, overflow: 'auto' }}>
          <div style={{ whiteSpace: 'pre-wrap' }}>{p.text ?? ''}</div>
          {p.link ? <a href={p.link} onClick={(e) => e.preventDefault()} style={{ color: '#2563eb', fontSize: 11 }}>{p.link}</a> : null}
        </div>
      )
    case 'divider':
      return <div style={{ ...css, background: css.background ?? '#d0d0d0' }} />
    case 'icon':
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: css.fontSize ?? 24 }}>
          {p.glyph ?? '★'}
        </div>
      )
    case 'row':
    case 'column':
    case 'container':
    default:
      return (
        <div
          style={{
            ...css,
            background: css.background ?? 'rgba(148,163,184,0.08)',
            border: css.border ?? '1px dashed #cbd5e1'
          }}
        />
      )
  }
}
