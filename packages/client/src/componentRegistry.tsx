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
