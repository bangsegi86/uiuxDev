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

/** Split a comma-separated prop into a trimmed list. */
function splitList(v: unknown): string[] {
  return String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const ALERT_STYLES: Record<string, [string, string, string]> = {
  info: ['#dbeafe', '#2563eb', 'ℹ️'],
  success: ['#dcfce7', '#16a34a', '✅'],
  warning: ['#fef3c7', '#d97706', '⚠️'],
  error: ['#fee2e2', '#dc2626', '⛔']
}

/** Render the inner content of a primitive (the outer positioned box is the canvas's job). */
export function renderPrimitive(node: NodeInstance): React.ReactNode {
  const css = { ...fill, ...toCss(node.style) }
  const visual = toCss(node.style)
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
    case 'input': {
      const required = Boolean(node.props.required)
      return (
        <div style={{ ...css, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {p.label ? (
            <span style={{ fontSize: 11, lineHeight: 1.2 }}>
              {p.label}
              {required ? <span style={{ color: '#dc2626' }}> *</span> : null}
            </span>
          ) : null}
          <input
            readOnly
            placeholder={p.placeholder ?? ''}
            style={{
              flex: 1,
              minHeight: 0,
              boxSizing: 'border-box',
              border: required ? '1px solid #f87171' : (visual.border ?? '1px solid #cbd5e1'),
              borderRadius: visual.borderRadius ?? 6,
              padding: visual.padding ?? '0 8px',
              background: node.props.readonly ? '#f1f5f9' : visual.background,
              color: visual.color,
              fontSize: visual.fontSize
            }}
          />
        </div>
      )
    }
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, border: node.props.required ? '1px solid #f87171' : '1px solid #cbd5e1', borderRadius: 6, padding: '0 8px', background: node.props.readonly ? '#f1f5f9' : '#fff' }}>
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
    case 'toggle': {
      const on = Boolean(node.props.checked)
      const onColor = (p.onColor as string) || '#2563eb'
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>{p.label ?? ''}</span>
          <span style={{ position: 'relative', width: 40, height: 24, borderRadius: 12, background: on ? onColor : '#cbd5e1', flex: '0 0 auto' }}>
            <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
          </span>
        </div>
      )
    }
    case 'toast': {
      const variant = (p.variant as string) || 'info'
      const colors: Record<string, string> = { info: '#334155', success: '#16a34a', warning: '#d97706', error: '#dc2626' }
      const icons: Record<string, string> = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '⛔' }
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: css.background ?? colors[variant], color: css.color ?? '#fff', borderRadius: css.borderRadius ?? 8, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <span>{icons[variant]}</span>
          <span style={{ flex: 1 }}>{p.message ?? ''}</span>
          {p.action ? <span style={{ fontWeight: 700, color: '#93c5fd' }}>{p.action}</span> : null}
        </div>
      )
    }
    case 'badge': {
      const dot = Boolean(node.props.dot)
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', justifyContent: 'center', background: css.background ?? '#dc2626', color: css.color ?? '#fff', borderRadius: 999, fontSize: css.fontSize ?? 12, fontWeight: 700 }}>
          {dot ? '' : (p.text ?? '')}
        </div>
      )
    }
    case 'avatar': {
      const shape = (p.shape as string) || 'circle'
      const radius = shape === 'circle' ? '50%' : (css.borderRadius ?? 8)
      return p.src ? (
        <img src={p.src} alt="" style={{ ...css, objectFit: 'cover', borderRadius: radius }} />
      ) : (
        <div style={{ ...css, borderRadius: radius, background: css.background ?? '#94a3b8', color: css.color ?? '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
          {p.initials ?? ''}
        </div>
      )
    }
    case 'chip':
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: css.background ?? '#e2e8f0', color: css.color ?? '#0f172a', borderRadius: css.borderRadius ?? 999, padding: '0 10px', fontSize: css.fontSize ?? 13 }}>
          <span>{p.text ?? ''}</span>
          {Boolean(node.props.removable) && <span style={{ opacity: 0.6 }}>×</span>}
        </div>
      )
    case 'fab':
      return (
        <div style={{ ...css, borderRadius: '50%', background: css.background ?? '#2563eb', color: css.color ?? '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: css.fontSize ?? 24, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          {p.glyph ?? '＋'}
        </div>
      )
    case 'searchbar':
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', gap: 8, background: css.background ?? '#f1f5f9', borderRadius: css.borderRadius ?? 999, padding: '0 12px', color: '#64748b' }}>
          🔍 <span>{p.placeholder ?? ''}</span>
        </div>
      )
    case 'slider': {
      const min = Number(p.min ?? 0)
      const max = Number(p.max ?? 100)
      const pct = max > min ? Math.max(0, Math.min(100, ((Number(p.value ?? 0) - min) / (max - min)) * 100)) : 0
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%', height: 4, background: '#cbd5e1', borderRadius: 2 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: 4, width: `${pct}%`, background: css.background ?? '#2563eb', borderRadius: 2 }} />
            <div style={{ position: 'absolute', left: `${pct}%`, top: -6, marginLeft: -8, width: 16, height: 16, borderRadius: '50%', background: '#fff', border: '2px solid #2563eb' }} />
          </div>
        </div>
      )
    }
    case 'progress': {
      const pct = Math.max(0, Math.min(100, Number(p.value ?? 0)))
      return (
        <div style={{ ...css, background: css.background ?? '#e2e8f0', borderRadius: css.borderRadius ?? 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#2563eb' }} />
        </div>
      )
    }
    case 'stepper':
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: css.borderRadius ?? 8, overflow: 'hidden' }}>
          <span style={{ width: 32, textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>−</span>
          <span style={{ flex: 1, textAlign: 'center' }}>{p.value ?? 0}</span>
          <span style={{ width: 32, textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>＋</span>
        </div>
      )
    case 'rating': {
      const val = Number(p.value ?? 0)
      const max = Number(p.max ?? 5)
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', gap: 2, fontSize: css.fontSize ?? 18, color: css.color ?? '#f59e0b' }}>
          {Array.from({ length: max }).map((_, i) => (
            <span key={i}>{i < val ? '★' : '☆'}</span>
          ))}
        </div>
      )
    }
    case 'bottomnav': {
      const items = String(p.items ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      const icons = String(p.icons ?? '').split(',').map((s) => s.trim())
      const active = Number(p.active ?? 0)
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', background: css.background ?? '#ffffff', borderTop: '1px solid #e2e8f0' }}>
          {items.map((it, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 11, color: i === active ? (css.color ?? '#2563eb') : '#94a3b8' }}>
              <span style={{ fontSize: 18 }}>{icons[i] || '•'}</span>
              {it}
            </div>
          ))}
        </div>
      )
    }
    case 'bottomsheet':
      return (
        <div style={{ ...css, background: css.background ?? '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' }}>
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 40, height: 4, borderRadius: 2, background: '#cbd5e1' }} />
          <div style={{ padding: '20px 16px 8px', fontWeight: 700 }}>{p.title ?? ''}</div>
        </div>
      )
    case 'accordion': {
      const items = splitList(p.items)
      const open = Number(p.openIndex ?? 0)
      return (
        <div style={{ ...css, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {items.map((it, i) => (
            <div key={i} style={{ borderTop: i ? '1px solid #e2e8f0' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontWeight: 600, background: i === open ? '#f8fafc' : '#fff' }}>
                {it}
                <span>{i === open ? '▾' : '▸'}</span>
              </div>
              {i === open && <div style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>내용…</div>}
            </div>
          ))}
        </div>
      )
    }
    case 'segmented': {
      const opts = splitList(p.options)
      const val = Number(p.value ?? 0)
      return (
        <div style={{ ...css, display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 2 }}>
          {opts.map((o, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: i === val ? '#fff' : 'transparent', color: i === val ? '#0f172a' : '#64748b', fontWeight: i === val ? 600 : 400, boxShadow: i === val ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>
              {o}
            </div>
          ))}
        </div>
      )
    }
    case 'listitem':
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', background: css.background ?? '#fff', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 22 }}>{p.leading ?? ''}</span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600 }}>{p.title ?? ''}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{p.subtitle ?? ''}</span>
          </div>
          <span style={{ color: '#94a3b8' }}>{p.trailing ?? ''}</span>
        </div>
      )
    case 'spinner': {
      const d = Math.max(12, Math.min(node.layout.w, node.layout.h) - 8)
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="uiux-spinner" style={{ width: d, height: d, borderTopColor: (p.color as string) || '#2563eb' }} />
        </div>
      )
    }
    case 'carousel': {
      const dots = Number(p.count ?? 0)
      const active = Number(p.active ?? 0)
      return (
        <div style={{ ...css, position: 'relative', background: '#e2e8f0', borderRadius: css.borderRadius ?? 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: '#64748b' }}>
          <span>🖼 {p.label ?? ''}</span>
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', gap: 6, justifyContent: 'center' }}>
            {Array.from({ length: dots }).map((_, i) => (
              <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === active ? '#2563eb' : '#cbd5e1' }} />
            ))}
          </div>
        </div>
      )
    }
    case 'alertcard': {
      const c = ALERT_STYLES[(p.variant as string) || 'info'] ?? ALERT_STYLES.info
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: css.background ?? c[0], borderLeft: `4px solid ${c[1]}`, borderRadius: css.borderRadius ?? 8 }}>
          <span>{c[2]}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{p.title ?? ''}</div>
            <div style={{ fontSize: 12, color: '#475569' }}>{p.message ?? ''}</div>
          </div>
          {Boolean(node.props.closable) && <span style={{ color: '#94a3b8' }}>×</span>}
        </div>
      )
    }
    case 'tabs': {
      const items = splitList(p.items)
      const active = Number(p.active ?? 0)
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'flex-end', borderBottom: '1px solid #e2e8f0' }}>
          {items.map((it, i) => (
            <div key={i} style={{ padding: '8px 14px', fontWeight: i === active ? 600 : 400, color: i === active ? '#2563eb' : '#64748b', borderBottom: i === active ? '2px solid #2563eb' : '2px solid transparent', marginBottom: -1 }}>
              {it}
            </div>
          ))}
        </div>
      )
    }
    case 'dropdown':
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: css.borderRadius ?? 6, background: css.background ?? '#fff', color: p.value ? (css.color ?? '#0f172a') : '#94a3b8' }}>
          <span>{p.value || p.placeholder || ''}</span>
          <span style={{ color: '#64748b' }}>▾</span>
        </div>
      )
    case 'card':
      return (
        <div style={{ ...css, background: css.background ?? '#fff', border: '1px solid #e2e8f0', borderRadius: css.borderRadius ?? 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {p.title ? <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{p.title}</div> : null}
        </div>
      )
    case 'navbar': {
      const items = splitList(p.items)
      const active = Number(p.active ?? 0)
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', gap: 24, padding: '0 20px', background: css.background ?? '#0f172a', color: css.color ?? '#fff' }}>
          <span style={{ fontWeight: 800 }}>{p.brand ?? ''}</span>
          <div style={{ display: 'flex', gap: 18, marginLeft: 'auto' }}>
            {items.map((it, i) => (
              <span key={i} style={{ opacity: i === active ? 1 : 0.7, fontWeight: i === active ? 700 : 400 }}>
                {it}
              </span>
            ))}
          </div>
        </div>
      )
    }
    case 'sidebar': {
      const items = splitList(p.items)
      const icons = splitList(p.icons)
      const active = Number(p.active ?? 0)
      return (
        <div style={{ ...css, display: 'flex', flexDirection: 'column', padding: '12px 8px', gap: 4, background: css.background ?? '#0f172a', color: '#cbd5e1' }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: i === active ? '#1e293b' : 'transparent', color: i === active ? '#fff' : '#cbd5e1' }}>
              <span>{icons[i] || '•'}</span>
              {it}
            </div>
          ))}
        </div>
      )
    }
    case 'breadcrumb': {
      const items = splitList(p.items)
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: css.fontSize ?? 13 }}>
          {items.map((it, i) => (
            <span key={i} style={{ display: 'flex', gap: 6 }}>
              {i > 0 && <span style={{ opacity: 0.5 }}>/</span>}
              <span style={{ color: i === items.length - 1 ? '#0f172a' : '#64748b' }}>{it}</span>
            </span>
          ))}
        </div>
      )
    }
    case 'pagination': {
      const pages = Number(p.pages ?? 0)
      const active = Number(p.active ?? 1)
      const cell = (on: boolean): React.CSSProperties => ({
        minWidth: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: '1px solid #e2e8f0',
        background: on ? '#2563eb' : '#fff',
        color: on ? '#fff' : '#0f172a'
      })
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
          <span style={cell(false)}>‹</span>
          {Array.from({ length: pages }).map((_, i) => (
            <span key={i} style={cell(i + 1 === active)}>{i + 1}</span>
          ))}
          <span style={cell(false)}>›</span>
        </div>
      )
    }
    case 'menubar': {
      const items = splitList(p.items)
      return (
        <div style={{ ...css, display: 'flex', alignItems: 'center', background: css.background ?? '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>
          {items.map((it, i) => (
            <span key={i} style={{ padding: '0 12px', lineHeight: `${node.layout.h}px` }}>{it}</span>
          ))}
        </div>
      )
    }
    case 'statcard': {
      const up = !String(p.delta ?? '').trim().startsWith('-')
      return (
        <div style={{ ...css, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '12px 16px', background: css.background ?? '#fff', border: '1px solid #e2e8f0', borderRadius: css.borderRadius ?? 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>{p.label ?? ''}</span>
          <span style={{ fontSize: 24, fontWeight: 800 }}>{p.value ?? ''}</span>
          <span style={{ fontSize: 12, color: up ? '#16a34a' : '#dc2626' }}>{p.delta ?? ''}</span>
        </div>
      )
    }
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
