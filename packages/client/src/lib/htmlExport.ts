import { isSpecEmpty, type CustomComponent, type ElementSpec, type NodeInstance, type Screen } from '@uiux/shared'

/** Export a screen design to a self-contained, standalone HTML document. */
export function exportScreenToHtml(screen: Screen, components: CustomComponent[]): string {
  const body = screen.root.children.map((n) => renderNode(n, components)).join('\n')
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(screen.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f5f9; }
  .uiux-screen { position: relative; margin: 0 auto; background: #fff; overflow: hidden; }
  .uiux-node { position: absolute; }
  @keyframes uiux-spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
  <div class="uiux-screen" style="width:${screen.canvas.width}px;height:${screen.canvas.height}px;">
${body}
  </div>
</body>
</html>`
}

const PX_KEYS = new Set(['borderWidth', 'borderRadius', 'fontSize', 'padding'])

function styleText(style: Record<string, string>): string {
  const parts: string[] = []
  let borderColor = '#cccccc'
  let borderWidth = ''
  for (const [k, v] of Object.entries(style)) {
    if (v === '' || v == null) continue
    if (k === 'borderColor') {
      borderColor = v
      continue
    }
    if (k === 'borderWidth') {
      borderWidth = v
      continue
    }
    const val = PX_KEYS.has(k) && /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v
    parts.push(`${camelToKebab(k)}:${val}`)
  }
  if (borderWidth) {
    const bw = /^\d+(\.\d+)?$/.test(borderWidth) ? `${borderWidth}px` : borderWidth
    parts.push(`border:${bw} solid ${borderColor}`)
  }
  return parts.join(';')
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** `data-spec-*` attributes for the set fields of an element's developer spec. */
function specAttrs(spec?: ElementSpec): string {
  if (isSpecEmpty(spec)) return ''
  const out: string[] = []
  for (const [key, value] of Object.entries(spec!)) {
    if (value === undefined || value === null || value === '') continue
    out.push(`data-spec-${camelToKebab(key)}="${escapeHtml(String(value))}"`)
  }
  return out.length ? ' ' + out.join(' ') : ''
}

/** A leading HTML comment summarising the developer spec (skipped when empty). */
function specComment(spec?: ElementSpec): string {
  if (isSpecEmpty(spec)) return ''
  const bits: string[] = []
  if (spec!.behavior) bits.push(`behavior=${spec!.behavior}`)
  if (spec!.devNote) bits.push(`note=${spec!.devNote}`)
  if (spec!.ticketRef) bits.push(`ticket=${spec!.ticketRef}`)
  return `<!-- DevSpec: ${escapeHtml(bits.join('; '))} -->\n`
}

/** Insert spec attributes into the first `.uiux-node` opening tag of `html`. */
function injectSpecAttrs(html: string, attrs: string): string {
  if (!attrs) return html
  return html.replace('class="uiux-node"', `class="uiux-node"${attrs}`)
}

function box(node: NodeInstance, extra = ''): string {
  const { x, y, w, h } = node.layout
  return `left:${x}px;top:${y}px;width:${w}px;height:${h}px;${extra}`
}

/** Split a comma-separated prop into a trimmed list. */
function listOf(v: unknown): string[] {
  return String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

interface GridCol {
  title: string
  width: number
  colSpan?: number
}

function gridHtml(node: NodeInstance): string {
  const columns = (node.props.columns as GridCol[] | undefined) ?? []
  const rowCount = (node.props.rowCount as number | undefined) ?? 0
  const cols = columns.map((c) => `<col style="width:${c.width}px"/>`).join('')
  const headers: string[] = []
  for (let i = 0; i < columns.length; ) {
    const span = Math.max(1, columns[i].colSpan ?? 1)
    headers.push(`<th colspan="${span}" style="border:1px solid #cbd5e1;background:#f1f5f9;padding:4px 6px;">${escapeHtml(columns[i].title)}</th>`)
    i += span
  }
  const bodyRow = `<tr>${columns.map(() => '<td style="border:1px solid #e2e8f0;padding:4px 6px;height:24px;"></td>').join('')}</tr>`
  const body = Array.from({ length: rowCount }).map(() => bodyRow).join('')
  return `<table style="border-collapse:collapse;width:100%;font-size:12px;table-layout:fixed;"><colgroup>${cols}</colgroup><thead><tr>${headers.join('')}</tr></thead><tbody>${body}</tbody></table>`
}

function renderNode(node: NodeInstance, components: CustomComponent[]): string {
  const spec = node.props.spec as ElementSpec | undefined
  const html = injectSpecAttrs(renderNodeBody(node, components), specAttrs(spec))
  return specComment(spec) + html
}

function renderNodeBody(node: NodeInstance, components: CustomComponent[]): string {
  if (node.type.startsWith('custom:')) {
    const comp = components.find((c) => c.id === node.type.slice('custom:'.length))
    if (!comp) return `<div class="uiux-node" style="${box(node)}"></div>`
    const sx = node.layout.w / (comp.definition.layout.w || 1)
    const sy = node.layout.h / (comp.definition.layout.h || 1)
    const inner = comp.definition.children.map((c) => renderNode(c, components)).join('\n')
    return `<div class="uiux-node" style="${box(node, 'overflow:hidden;')}">
  <div style="position:absolute;left:0;top:0;width:${comp.definition.layout.w}px;height:${comp.definition.layout.h}px;transform:scale(${sx},${sy});transform-origin:top left;">
${inner}
  </div>
</div>`
  }

  const p = node.props as Record<string, string>
  const style = styleText(node.style)
  const children = node.children.map((c) => renderNode(c, components)).join('\n')

  switch (node.type) {
    case 'text':
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;')}${style}">${escapeHtml(p.text ?? 'Text')}</div>`
    case 'button':
      return `<div class="uiux-node" style="${box(node)}"><button style="width:100%;height:100%;border:none;border-radius:6px;background:#2563eb;color:#fff;${style}">${escapeHtml(p.text ?? 'Button')}</button></div>`
    case 'input': {
      const required = Boolean(node.props.required)
      const border = required ? '#f87171' : '#cbd5e1'
      const label = p.label ? `<span style="font-size:11px;line-height:1.2;">${escapeHtml(p.label)}${required ? ' <span style="color:#dc2626;">*</span>' : ''}</span>` : ''
      return `<div class="uiux-node" style="${box(node, 'display:flex;flex-direction:column;gap:2px;')}">${label}<input placeholder="${escapeHtml(p.placeholder ?? '')}" ${node.props.readonly ? 'disabled' : ''} style="flex:1;min-height:0;box-sizing:border-box;border:1px solid ${border};border-radius:6px;padding:0 8px;${node.props.readonly ? 'background:#f1f5f9;' : ''}${style}" /></div>`
    }
    case 'image':
      return p.src
        ? `<img class="uiux-node" src="${escapeHtml(p.src)}" alt="${escapeHtml(p.alt ?? '')}" style="${box(node, 'object-fit:cover;')}${style}" />`
        : `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;justify-content:center;background:#e2e8f0;color:#64748b;')}">Image</div>`
    case 'divider':
      return `<div class="uiux-node" style="${box(node)}background:${node.style.background || '#d0d0d0'};"></div>`
    case 'icon':
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;justify-content:center;')}${style}">${escapeHtml(p.glyph ?? '★')}</div>`
    case 'toggle': {
      const on = Boolean(node.props.checked)
      const onColor = (p.onColor as string) || '#2563eb'
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;justify-content:space-between;gap:8px;')}${style}"><span>${escapeHtml(p.label ?? '')}</span><span style="position:relative;width:40px;height:24px;border-radius:12px;flex:0 0 auto;background:${on ? onColor : '#cbd5e1'};"><span style="position:absolute;top:2px;left:${on ? 18 : 2}px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);"></span></span></div>`
    }
    case 'toast': {
      const variant = (p.variant as string) || 'info'
      const colors: Record<string, string> = { info: '#334155', success: '#16a34a', warning: '#d97706', error: '#dc2626' }
      const icons: Record<string, string> = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '⛔' }
      return `<div class="uiux-node" style="${box(node, `display:flex;align-items:center;gap:8px;padding:0 12px;color:#fff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.2);background:${colors[variant]};`)}${style}"><span>${icons[variant]}</span><span style="flex:1;">${escapeHtml(p.message ?? '')}</span>${p.action ? `<span style="font-weight:700;color:#93c5fd;">${escapeHtml(p.action)}</span>` : ''}</div>`
    }
    case 'badge':
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;justify-content:center;border-radius:999px;font-weight:700;font-size:12px;background:#dc2626;color:#fff;')}${style}">${node.props.dot ? '' : escapeHtml(p.text ?? '')}</div>`
    case 'avatar': {
      const radius = (p.shape ?? 'circle') === 'circle' ? '50%' : '8px'
      return p.src
        ? `<img class="uiux-node" src="${escapeHtml(p.src)}" alt="" style="${box(node, `object-fit:cover;border-radius:${radius};`)}" />`
        : `<div class="uiux-node" style="${box(node, `display:flex;align-items:center;justify-content:center;font-weight:600;background:#94a3b8;color:#fff;border-radius:${radius};`)}${style}">${escapeHtml(p.initials ?? '')}</div>`
    }
    case 'chip':
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;justify-content:center;gap:6px;border-radius:999px;padding:0 10px;font-size:13px;background:#e2e8f0;color:#0f172a;')}${style}"><span>${escapeHtml(p.text ?? '')}</span>${node.props.removable ? '<span style="opacity:.6;">×</span>' : ''}</div>`
    case 'fab':
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:24px;background:#2563eb;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.3);')}${style}">${escapeHtml(p.glyph ?? '＋')}</div>`
    case 'searchbar':
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:999px;background:#f1f5f9;color:#64748b;')}${style}">🔍 <span>${escapeHtml(p.placeholder ?? '')}</span></div>`
    case 'slider': {
      const min = Number(p.min ?? 0)
      const max = Number(p.max ?? 100)
      const pct = max > min ? Math.max(0, Math.min(100, ((Number(p.value ?? 0) - min) / (max - min)) * 100)) : 0
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;')}"><div style="position:relative;width:100%;height:4px;background:#cbd5e1;border-radius:2px;"><div style="position:absolute;left:0;top:0;height:4px;width:${pct}%;background:#2563eb;border-radius:2px;"></div><div style="position:absolute;left:${pct}%;top:-6px;margin-left:-8px;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid #2563eb;"></div></div></div>`
    }
    case 'progress': {
      const pct = Math.max(0, Math.min(100, Number(p.value ?? 0)))
      return `<div class="uiux-node" style="${box(node, 'border-radius:999px;overflow:hidden;background:#e2e8f0;')}"><div style="height:100%;width:${pct}%;background:#2563eb;"></div></div>`
    }
    case 'stepper':
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;')}${style}"><span style="width:32px;text-align:center;border-right:1px solid #e2e8f0;">−</span><span style="flex:1;text-align:center;">${escapeHtml(String(p.value ?? 0))}</span><span style="width:32px;text-align:center;border-left:1px solid #e2e8f0;">＋</span></div>`
    case 'rating': {
      const val = Number(p.value ?? 0)
      const max = Number(p.max ?? 5)
      const stars = Array.from({ length: max }).map((_, i) => (i < val ? '★' : '☆')).join('')
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;gap:2px;font-size:18px;color:#f59e0b;')}">${stars}</div>`
    }
    case 'bottomnav': {
      const items = String(p.items ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      const icons = String(p.icons ?? '').split(',').map((s) => s.trim())
      const active = Number(p.active ?? 0)
      const cells = items
        .map((it, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;color:${i === active ? '#2563eb' : '#94a3b8'};"><span style="font-size:18px;">${escapeHtml(icons[i] || '•')}</span>${escapeHtml(it)}</div>`)
        .join('')
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;background:#fff;border-top:1px solid #e2e8f0;')}">${cells}</div>`
    }
    case 'checkbox':
      return `<label class="uiux-node" style="${box(node, 'display:flex;align-items:center;gap:6px;')}"><input type="checkbox" ${node.props.checked ? 'checked' : ''} ${node.props.readonly ? 'disabled' : ''}/> <span>${escapeHtml(p.label ?? 'Checkbox')}${node.props.required ? ' *' : ''}</span></label>`
    case 'radio': {
      const opts = String(p.options ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      const radios = opts
        .map((o) => `<label style="display:flex;align-items:center;gap:6px;"><input type="radio" ${p.value === o ? 'checked' : ''} disabled/> ${escapeHtml(o)}</label>`)
        .join('')
      return `<div class="uiux-node" style="${box(node, 'display:flex;flex-direction:column;gap:4px;')}">${p.label ? `<div style="font-weight:600;">${escapeHtml(p.label)}${node.props.required ? ' *' : ''}</div>` : ''}${radios}</div>`
    }
    case 'calendar': {
      const required = Boolean(node.props.required)
      const border = required ? '#f87171' : '#cbd5e1'
      const label = p.label ? `<span style="font-size:11px;">${escapeHtml(p.label)}${required ? ' <span style="color:#dc2626;">*</span>' : ''}</span>` : ''
      return `<div class="uiux-node" style="${box(node, 'display:flex;flex-direction:column;gap:2px;')}">${label}<div style="flex:1;min-height:0;display:flex;align-items:center;gap:6px;border:1px solid ${border};border-radius:6px;padding:0 8px;background:${node.props.readonly ? '#f1f5f9' : '#fff'};">📅 <span>${escapeHtml(p.value || p.placeholder || 'YYYY-MM-DD')}</span></div></div>`
    }
    case 'grid':
      return `<div class="uiux-node" style="${box(node, 'overflow:auto;')}">${gridHtml(node)}</div>`
    case 'modal':
      return `<div class="uiux-node" style="${box(node, `display:flex;align-items:center;justify-content:center;${node.props.showOverlay !== false ? 'background:rgba(15,23,42,0.35);' : ''}`)}"><div style="width:90%;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.2);padding:16px;">${'<div style="font-weight:700;margin-bottom:8px;">' + escapeHtml(p.title ?? 'Title') + '</div>'}<div style="color:#334155;margin-bottom:12px;white-space:pre-wrap;">${escapeHtml(p.message ?? '')}</div><div style="display:flex;justify-content:flex-end;gap:8px;">${p.cancelText ? `<button>${escapeHtml(p.cancelText)}</button>` : ''}<button style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 12px;">${escapeHtml(p.confirmText ?? 'OK')}</button></div></div></div>`
    case 'annotation':
      return `<div class="uiux-node" style="${box(node, 'background:#fff8c5;border:1px solid #e3c000;border-radius:6px;padding:8px;font-size:12px;overflow:auto;')}"><div style="white-space:pre-wrap;">${escapeHtml(p.text ?? '')}</div>${p.link ? `<a href="${escapeHtml(p.link)}" style="color:#2563eb;font-size:11px;">${escapeHtml(p.link)}</a>` : ''}</div>`
    case 'bottomsheet':
      return `<div class="uiux-node" style="${box(node, 'background:#fff;border-radius:16px 16px 0 0;box-shadow:0 -4px 20px rgba(0,0,0,0.15);')}"><div style="position:absolute;top:8px;left:50%;transform:translateX(-50%);width:40px;height:4px;border-radius:2px;background:#cbd5e1;"></div><div style="padding:20px 16px 8px;font-weight:700;">${escapeHtml(p.title ?? '')}</div>\n${children}</div>`
    case 'accordion': {
      const items = listOf(p.items)
      const open = Number(p.openIndex ?? 0)
      const rows = items
        .map(
          (it, i) =>
            `<div style="border-top:${i ? '1px solid #e2e8f0' : 'none'};"><div style="display:flex;justify-content:space-between;padding:8px 12px;font-weight:600;background:${i === open ? '#f8fafc' : '#fff'};">${escapeHtml(it)}<span>${i === open ? '▾' : '▸'}</span></div>${i === open ? '<div style="padding:8px 12px;color:#64748b;font-size:12px;">내용…</div>' : ''}</div>`
        )
        .join('')
      return `<div class="uiux-node" style="${box(node, 'border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;')}">${rows}</div>`
    }
    case 'segmented': {
      const opts = listOf(p.options)
      const val = Number(p.value ?? 0)
      const segs = opts
        .map((o, i) => `<div style="flex:1;display:flex;align-items:center;justify-content:center;border-radius:6px;background:${i === val ? '#fff' : 'transparent'};color:${i === val ? '#0f172a' : '#64748b'};font-weight:${i === val ? 600 : 400};">${escapeHtml(o)}</div>`)
        .join('')
      return `<div class="uiux-node" style="${box(node, 'display:flex;background:#e2e8f0;border-radius:8px;padding:2px;')}">${segs}</div>`
    }
    case 'listitem':
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;gap:12px;padding:0 12px;background:#fff;border-bottom:1px solid #f1f5f9;')}"><span style="font-size:22px;">${escapeHtml(p.leading ?? '')}</span><div style="flex:1;display:flex;flex-direction:column;"><span style="font-weight:600;">${escapeHtml(p.title ?? '')}</span><span style="font-size:12px;color:#94a3b8;">${escapeHtml(p.subtitle ?? '')}</span></div><span style="color:#94a3b8;">${escapeHtml(p.trailing ?? '')}</span></div>`
    case 'spinner': {
      const d = Math.max(12, Math.min(node.layout.w, node.layout.h) - 8)
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;justify-content:center;')}"><div style="width:${d}px;height:${d}px;border:3px solid #e2e8f0;border-top-color:${escapeHtml((p.color as string) || '#2563eb')};border-radius:50%;animation:uiux-spin .8s linear infinite;"></div></div>`
    }
    case 'carousel': {
      const dots = Number(p.count ?? 0)
      const active = Number(p.active ?? 0)
      const dotEls = Array.from({ length: dots }).map((_, i) => `<span style="width:7px;height:7px;border-radius:50%;background:${i === active ? '#2563eb' : '#cbd5e1'};"></span>`).join('')
      return `<div class="uiux-node" style="${box(node, 'position:relative;background:#e2e8f0;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#64748b;')}"><span>🖼 ${escapeHtml(p.label ?? '')}</span><div style="position:absolute;bottom:8px;left:0;right:0;display:flex;gap:6px;justify-content:center;">${dotEls}</div></div>`
    }
    case 'alertcard': {
      const map: Record<string, [string, string, string]> = { info: ['#dbeafe', '#2563eb', 'ℹ️'], success: ['#dcfce7', '#16a34a', '✅'], warning: ['#fef3c7', '#d97706', '⚠️'], error: ['#fee2e2', '#dc2626', '⛔'] }
      const c = map[(p.variant as string) || 'info'] ?? map.info
      return `<div class="uiux-node" style="${box(node, `display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:${c[0]};border-left:4px solid ${c[1]};border-radius:8px;`)}"><span>${c[2]}</span><div style="flex:1;"><div style="font-weight:700;">${escapeHtml(p.title ?? '')}</div><div style="font-size:12px;color:#475569;">${escapeHtml(p.message ?? '')}</div></div>${node.props.closable ? '<span style="color:#94a3b8;">×</span>' : ''}</div>`
    }
    case 'tabs': {
      const items = listOf(p.items)
      const active = Number(p.active ?? 0)
      const tabEls = items.map((it, i) => `<div style="padding:8px 14px;font-weight:${i === active ? 600 : 400};color:${i === active ? '#2563eb' : '#64748b'};border-bottom:2px solid ${i === active ? '#2563eb' : 'transparent'};margin-bottom:-1px;">${escapeHtml(it)}</div>`).join('')
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:flex-end;border-bottom:1px solid #e2e8f0;')}">${tabEls}</div>`
    }
    case 'dropdown':
      return `<div class="uiux-node" style="${box(node, `display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 10px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:${p.value ? '#0f172a' : '#94a3b8'};`)}"><span>${escapeHtml(p.value || p.placeholder || '')}</span><span style="color:#64748b;">▾</span></div>`
    case 'card':
      return `<div class="uiux-node" style="${box(node, 'background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;')}">${p.title ? `<div style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-weight:700;">${escapeHtml(p.title)}</div>` : ''}\n${children}</div>`
    case 'navbar': {
      const items = listOf(p.items)
      const active = Number(p.active ?? 0)
      const links = items.map((it, i) => `<span style="opacity:${i === active ? 1 : 0.7};font-weight:${i === active ? 700 : 400};">${escapeHtml(it)}</span>`).join('')
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;gap:24px;padding:0 20px;background:#0f172a;color:#fff;')}"><span style="font-weight:800;">${escapeHtml(p.brand ?? '')}</span><div style="display:flex;gap:18px;margin-left:auto;">${links}</div></div>`
    }
    case 'sidebar': {
      const items = listOf(p.items)
      const icons = listOf(p.icons)
      const active = Number(p.active ?? 0)
      const rows = items.map((it, i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:${i === active ? '#1e293b' : 'transparent'};color:${i === active ? '#fff' : '#cbd5e1'};"><span>${escapeHtml(icons[i] || '•')}</span>${escapeHtml(it)}</div>`).join('')
      return `<div class="uiux-node" style="${box(node, 'display:flex;flex-direction:column;padding:12px 8px;gap:4px;background:#0f172a;color:#cbd5e1;')}">${rows}</div>`
    }
    case 'breadcrumb': {
      const items = listOf(p.items)
      const parts = items.map((it, i) => `${i > 0 ? '<span style="opacity:.5;">/</span>' : ''}<span style="color:${i === items.length - 1 ? '#0f172a' : '#64748b'};">${escapeHtml(it)}</span>`).join('')
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;gap:6px;color:#64748b;font-size:13px;')}">${parts}</div>`
    }
    case 'pagination': {
      const pages = Number(p.pages ?? 0)
      const active = Number(p.active ?? 1)
      const cell = (on: boolean, label: string) => `<span style="min-width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid #e2e8f0;background:${on ? '#2563eb' : '#fff'};color:${on ? '#fff' : '#0f172a'};">${label}</span>`
      const nums = Array.from({ length: pages }).map((_, i) => cell(i + 1 === active, String(i + 1))).join('')
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;gap:4px;justify-content:center;')}">${cell(false, '‹')}${nums}${cell(false, '›')}</div>`
    }
    case 'menubar': {
      const items = listOf(p.items).map((it) => `<span style="padding:0 12px;line-height:${node.layout.h}px;">${escapeHtml(it)}</span>`).join('')
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;background:#f1f5f9;border-bottom:1px solid #e2e8f0;font-size:13px;')}">${items}</div>`
    }
    case 'statcard': {
      const up = !String(p.delta ?? '').trim().startsWith('-')
      return `<div class="uiux-node" style="${box(node, 'display:flex;flex-direction:column;justify-content:center;gap:4px;padding:12px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);')}"><span style="font-size:12px;color:#64748b;">${escapeHtml(p.label ?? '')}</span><span style="font-size:24px;font-weight:800;">${escapeHtml(p.value ?? '')}</span><span style="font-size:12px;color:${up ? '#16a34a' : '#dc2626'};">${escapeHtml(p.delta ?? '')}</span></div>`
    }
    case 'container':
    case 'row':
    case 'column':
    default:
      return `<div class="uiux-node" style="${box(node)}${style}">
${children}
</div>`
  }
}

/** Trigger a browser download of the screen as an .html file. */
export function downloadScreenHtml(screen: Screen, components: CustomComponent[]): void {
  const html = exportScreenToHtml(screen, components)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${screen.name || 'screen'}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
