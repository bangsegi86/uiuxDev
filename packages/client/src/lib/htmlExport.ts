import type { CustomComponent, NodeInstance, Screen } from '@uiux/shared'

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function box(node: NodeInstance, extra = ''): string {
  const { x, y, w, h } = node.layout
  return `left:${x}px;top:${y}px;width:${w}px;height:${h}px;${extra}`
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
    case 'input':
      return `<div class="uiux-node" style="${box(node)}"><input placeholder="${escapeHtml(p.placeholder ?? '')}" style="width:100%;height:100%;border:1px solid #cbd5e1;border-radius:6px;padding:0 8px;${style}" /></div>`
    case 'image':
      return p.src
        ? `<img class="uiux-node" src="${escapeHtml(p.src)}" alt="${escapeHtml(p.alt ?? '')}" style="${box(node, 'object-fit:cover;')}${style}" />`
        : `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;justify-content:center;background:#e2e8f0;color:#64748b;')}">Image</div>`
    case 'divider':
      return `<div class="uiux-node" style="${box(node)}background:${node.style.background || '#d0d0d0'};"></div>`
    case 'icon':
      return `<div class="uiux-node" style="${box(node, 'display:flex;align-items:center;justify-content:center;')}${style}">${escapeHtml(p.glyph ?? '★')}</div>`
    case 'checkbox':
      return `<label class="uiux-node" style="${box(node, 'display:flex;align-items:center;gap:6px;')}"><input type="checkbox" ${node.props.checked ? 'checked' : ''} ${node.props.readonly ? 'disabled' : ''}/> <span>${escapeHtml(p.label ?? 'Checkbox')}${node.props.required ? ' *' : ''}</span></label>`
    case 'radio': {
      const opts = String(p.options ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      const radios = opts
        .map((o) => `<label style="display:flex;align-items:center;gap:6px;"><input type="radio" ${p.value === o ? 'checked' : ''} disabled/> ${escapeHtml(o)}</label>`)
        .join('')
      return `<div class="uiux-node" style="${box(node, 'display:flex;flex-direction:column;gap:4px;')}">${p.label ? `<div style="font-weight:600;">${escapeHtml(p.label)}${node.props.required ? ' *' : ''}</div>` : ''}${radios}</div>`
    }
    case 'calendar':
      return `<div class="uiux-node" style="${box(node)}"><div style="height:100%;display:flex;align-items:center;gap:6px;border:1px solid #cbd5e1;border-radius:6px;padding:0 8px;background:${node.props.readonly ? '#f1f5f9' : '#fff'};">📅 <span>${escapeHtml(p.value || p.placeholder || 'YYYY-MM-DD')}</span></div></div>`
    case 'grid':
      return `<div class="uiux-node" style="${box(node, 'overflow:auto;')}">${gridHtml(node)}</div>`
    case 'modal':
      return `<div class="uiux-node" style="${box(node, `display:flex;align-items:center;justify-content:center;${node.props.showOverlay !== false ? 'background:rgba(15,23,42,0.35);' : ''}`)}"><div style="width:90%;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.2);padding:16px;">${'<div style="font-weight:700;margin-bottom:8px;">' + escapeHtml(p.title ?? 'Title') + '</div>'}<div style="color:#334155;margin-bottom:12px;white-space:pre-wrap;">${escapeHtml(p.message ?? '')}</div><div style="display:flex;justify-content:flex-end;gap:8px;">${p.cancelText ? `<button>${escapeHtml(p.cancelText)}</button>` : ''}<button style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 12px;">${escapeHtml(p.confirmText ?? 'OK')}</button></div></div></div>`
    case 'annotation':
      return `<div class="uiux-node" style="${box(node, 'background:#fff8c5;border:1px solid #e3c000;border-radius:6px;padding:8px;font-size:12px;overflow:auto;')}"><div style="white-space:pre-wrap;">${escapeHtml(p.text ?? '')}</div>${p.link ? `<a href="${escapeHtml(p.link)}" style="color:#2563eb;font-size:11px;">${escapeHtml(p.link)}</a>` : ''}</div>`
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
