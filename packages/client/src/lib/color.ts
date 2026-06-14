/** Color helpers for the property panel (computed-style → hex, etc.). */

/** Convert a CSS color (`rgb()/rgba()` or hex) to `#rrggbb`. Transparent → ''. */
export function rgbToHex(input: string): string {
  if (!input) return ''
  if (/^#[0-9a-fA-F]{6}$/.test(input)) return input.toLowerCase()
  const m = /rgba?\(([^)]+)\)/.exec(input)
  if (!m) return ''
  const parts = m[1].split(',').map((s) => s.trim())
  const [r, g, b] = parts.map(Number)
  const a = parts[3] !== undefined ? Number(parts[3]) : 1
  if (a === 0) return '' // fully transparent → treat as "none"
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** Coerce any color string to a valid `#rrggbb` for a native <input type=color>. */
export function toHex(v: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return '#' + v.slice(1).split('').map((c) => c + c).join('')
  }
  const conv = rgbToHex(v)
  return /^#[0-9a-fA-F]{6}$/.test(conv) ? conv : '#000000'
}

/** Strip a `px` value to a plain rounded number string ('13px' → '13'). */
export function stripPx(v: string): string {
  const n = parseFloat(v)
  return Number.isFinite(n) ? String(Math.round(n)) : ''
}
