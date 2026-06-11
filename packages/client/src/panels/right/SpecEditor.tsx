import type { ButtonActionType, ElementSpec, NodeInstance } from '@uiux/shared'
import { useI18n } from '../../i18n/I18nContext'

interface Props {
  node: NodeInstance
  updateProp: (id: string, key: string, value: unknown) => void
  checkpoint: () => void
}

const ACTION_TYPES: ButtonActionType[] = ['navigate', 'submit', 'openModal', 'custom']

/**
 * Developer-spec editor for the selected element. Stores an ElementSpec object
 * in `node.props.spec` (same prop-storage pattern as GridEditor). Common fields
 * show for every element; structured fields adapt to the element type.
 */
export function SpecEditor({ node, updateProp, checkpoint }: Props) {
  const { t } = useI18n()
  const spec = (node.props.spec as ElementSpec | undefined) ?? {}

  const patch = (p: Partial<ElementSpec>) => {
    checkpoint()
    updateProp(node.id, 'spec', { ...spec, ...p })
  }

  // Empty string clears a field; numbers parse or clear.
  const text = (key: keyof ElementSpec) => (v: string) => patch({ [key]: v || undefined } as Partial<ElementSpec>)
  const numeric = (key: keyof ElementSpec) => (v: string) =>
    patch({ [key]: v === '' ? undefined : Number(v) } as Partial<ElementSpec>)

  const actionLabel: Record<ButtonActionType, string> = {
    navigate: t.actNavigate,
    submit: t.actSubmit,
    openModal: t.actOpenModal,
    custom: t.actCustom
  }

  return (
    <div className="spec-editor">
      <label className="field">
        <span>{t.behavior}</span>
        <textarea value={spec.behavior ?? ''} onChange={(e) => text('behavior')(e.target.value)} />
      </label>

      {(node.type === 'input' || node.type === 'calendar') && (
        <>
          <div className="xy-grid">
            <label className="field inline">
              <span>{t.minLength}</span>
              <input type="number" value={spec.minLength ?? ''} onChange={(e) => numeric('minLength')(e.target.value)} />
            </label>
            <label className="field inline">
              <span>{t.maxLength}</span>
              <input type="number" value={spec.maxLength ?? ''} onChange={(e) => numeric('maxLength')(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>{t.pattern}</span>
            <input type="text" value={spec.pattern ?? ''} onChange={(e) => text('pattern')(e.target.value)} />
          </label>
          <label className="field">
            <span>{t.validationMessage}</span>
            <input type="text" value={spec.validationMessage ?? ''} onChange={(e) => text('validationMessage')(e.target.value)} />
          </label>
        </>
      )}

      {node.type === 'button' && (
        <>
          <label className="field">
            <span>{t.actionType}</span>
            <select value={spec.actionType ?? ''} onChange={(e) => text('actionType')(e.target.value)}>
              <option value="">—</option>
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>
                  {actionLabel[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t.actionTarget}</span>
            <input type="text" value={spec.actionTarget ?? ''} onChange={(e) => text('actionTarget')(e.target.value)} />
          </label>
          <label className="field">
            <span>{t.actionDescription}</span>
            <textarea value={spec.actionDescription ?? ''} onChange={(e) => text('actionDescription')(e.target.value)} />
          </label>
        </>
      )}

      {(node.type === 'radio' || node.type === 'checkbox' || node.type === 'grid') && (
        <label className="field">
          <span>{t.dataSource}</span>
          <input type="text" value={spec.dataSource ?? ''} onChange={(e) => text('dataSource')(e.target.value)} />
        </label>
      )}

      <label className="field">
        <span>{t.devNote}</span>
        <textarea value={spec.devNote ?? ''} onChange={(e) => text('devNote')(e.target.value)} />
      </label>
      <label className="field">
        <span>{t.ticketRef}</span>
        <input type="text" value={spec.ticketRef ?? ''} onChange={(e) => text('ticketRef')(e.target.value)} />
      </label>
    </div>
  )
}
