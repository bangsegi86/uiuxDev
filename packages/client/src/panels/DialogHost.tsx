import { useEffect, useState } from 'react'
import { useDialog } from '../state/dialogStore'
import { useI18n } from '../i18n/I18nContext'

/** Renders the active prompt/confirm dialog (see dialogStore). */
export function DialogHost() {
  const { t } = useI18n()
  const pending = useDialog((s) => s.pending)
  const close = useDialog((s) => s.close)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (pending?.kind === 'prompt') setValue(pending.defaultValue)
  }, [pending])

  if (!pending) return null
  const isPrompt = pending.kind === 'prompt'
  const cancelValue = isPrompt ? null : false
  const okValue = isPrompt ? value : true

  return (
    <div className="modal-overlay dialog-overlay" onClick={() => close(cancelValue)}>
      <div className="modal-box dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">{pending.title}</div>
        {isPrompt && (
          <input
            className="dialog-input"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') close(value)
              else if (e.key === 'Escape') close(null)
            }}
          />
        )}
        <div className="modal-foot">
          <span className="spacer" />
          <button onClick={() => close(cancelValue)}>{t.cancel}</button>
          <button className="primary" onClick={() => close(okValue)}>
            {t.ok}
          </button>
        </div>
      </div>
    </div>
  )
}
