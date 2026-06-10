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
