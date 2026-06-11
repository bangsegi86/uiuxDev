import {
  getPrimitive,
  isSpecEmpty,
  type CustomComponent,
  type ElementSpec,
  type NodeInstance,
  type Screen
} from '@uiux/shared'
import { escapeHtml } from './htmlExport'

interface SpecRow {
  type: string
  name: string
  pos: string
  behavior: string
  constraints: string
  note: string
}

/** Human label shown for a node (label/text/title prop, else the type). */
function nodeName(node: NodeInstance): string {
  const p = node.props as Record<string, unknown>
  return String(p.label ?? p.text ?? p.title ?? '—')
}

/** Compose the structured constraint fields of a spec into one cell string. */
function constraintsText(spec: ElementSpec): string {
  const bits: string[] = []
  if (spec.minLength !== undefined || spec.maxLength !== undefined) {
    bits.push(`length ${spec.minLength ?? 0}–${spec.maxLength ?? '∞'}`)
  }
  if (spec.pattern) bits.push(`pattern: ${spec.pattern}`)
  if (spec.validationMessage) bits.push(`msg: ${spec.validationMessage}`)
  if (spec.actionType) bits.push(`action: ${spec.actionType}${spec.actionTarget ? ` → ${spec.actionTarget}` : ''}`)
  if (spec.actionDescription) bits.push(spec.actionDescription)
  if (spec.dataSource) bits.push(`data: ${spec.dataSource}`)
  return bits.join('\n')
}

/** Collect a row for every node that carries a non-empty developer spec. */
function walk(node: NodeInstance, rows: SpecRow[]): void {
  const spec = node.props.spec as ElementSpec | undefined
  if (!node.type.startsWith('custom:') && !isSpecEmpty(spec)) {
    const s = spec!
    rows.push({
      type: getPrimitive(node.type)?.label ?? node.type,
      name: nodeName(node),
      pos: `${node.layout.x},${node.layout.y} · ${node.layout.w}×${node.layout.h}`,
      behavior: s.behavior ?? '',
      constraints: constraintsText(s),
      note: [s.devNote, s.ticketRef].filter(Boolean).join('\n')
    })
  }
  for (const child of node.children) walk(child, rows)
}

/** Build a standalone HTML spec sheet (one table) for a screen. */
export function exportScreenToSpecSheet(screen: Screen, _components: CustomComponent[]): string {
  const rows: SpecRow[] = []
  for (const child of screen.root.children) walk(child, rows)

  const cell = (v: string) => `<td>${escapeHtml(v).replace(/\n/g, '<br/>')}</td>`
  const body = rows.length
    ? rows
        .map(
          (r) =>
            `<tr>${cell(r.type)}${cell(r.name)}${cell(r.pos)}${cell(r.behavior)}${cell(r.constraints)}${cell(r.note)}</tr>`
        )
        .join('\n')
    : `<tr><td colspan="6" class="empty">문서화된 요소가 없습니다 / No documented elements</td></tr>`

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(screen.name)} — Spec Sheet</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #0f172a; }
  h1 { font-size: 18px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  td.empty { text-align: center; color: #94a3b8; }
  tr:nth-child(even) td { background: #f8fafc; }
</style>
</head>
<body>
  <h1>${escapeHtml(screen.name)} — 개발 명세서 (Spec Sheet)</h1>
  <div class="meta">${screen.device.toUpperCase()} · ${screen.canvas.width}×${screen.canvas.height} · ${rows.length} item(s)</div>
  <table>
    <thead>
      <tr><th>Type</th><th>Name</th><th>Position</th><th>Behavior</th><th>Constraints</th><th>Dev note</th></tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
</body>
</html>`
}

/** Trigger a browser download of the screen's spec sheet as an .html file. */
export function downloadScreenSpecSheet(screen: Screen, components: CustomComponent[]): void {
  const html = exportScreenToSpecSheet(screen, components)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${screen.name || 'screen'}-spec.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
