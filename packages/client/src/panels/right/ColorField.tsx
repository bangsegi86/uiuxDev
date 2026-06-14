import { useEffect, useRef, useState } from 'react'
import { toHex } from '../../lib/color'
import { useI18n } from '../../i18n/I18nContext'

/** Curated palette of common UI colors shown in the combo box. */
const PRESETS = [
  '#ffffff', '#f1f5f9', '#cbd5e1', '#94a3b8', '#64748b', '#0f172a', '#000000',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#2563eb',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e'
]

/**
 * Color picker shown as a combo box of common preset colors, with an
 * "other color" entry that opens the native picker for anything else.
 */
export function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const norm = value.toLowerCase()

  return (
    <div className="color-field" ref={ref}>
      <button type="button" className="color-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="color-chip" style={{ background: value || 'transparent' }} />
        <span className="color-hex">{value || t.colorNone}</span>
        <span className="color-caret">▾</span>
      </button>
      {open && (
        <div className="color-pop">
          <div className="color-grid">
            <button
              type="button"
              className="color-cell none"
              title={t.colorNone}
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              ∅
            </button>
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-cell${norm === c ? ' sel' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => {
                  onChange(c)
                  setOpen(false)
                }}
              />
            ))}
          </div>
          <label className="color-other">
            <span>{t.colorOther}</span>
            <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} />
          </label>
        </div>
      )}
    </div>
  )
}
