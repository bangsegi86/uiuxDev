import { useEditor, type AlignKind, type DistributeKind } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'

const ALIGN_BUTTONS: { kind: AlignKind; glyph: string; key: keyof ReturnType<typeof useI18n>['t'] }[] = [
  { kind: 'left', glyph: '⇤', key: 'alignLeft' },
  { kind: 'centerH', glyph: '↔', key: 'alignCenterH' },
  { kind: 'right', glyph: '⇥', key: 'alignRight' },
  { kind: 'top', glyph: '⤒', key: 'alignTop' },
  { kind: 'middle', glyph: '↕', key: 'alignMiddle' },
  { kind: 'bottom', glyph: '⤓', key: 'alignBottom' }
]

const DISTRIBUTE_BUTTONS: { kind: DistributeKind; glyph: string; key: keyof ReturnType<typeof useI18n>['t'] }[] = [
  { kind: 'horizontal', glyph: '⇿', key: 'distributeH' },
  { kind: 'vertical', glyph: '⇳', key: 'distributeV' }
]

export function AlignToolbar() {
  const { t } = useI18n()
  const selection = useEditor((s) => s.selection)
  const align = useEditor((s) => s.align)
  const distribute = useEditor((s) => s.distribute)
  const copy = useEditor((s) => s.copy)
  const paste = useEditor((s) => s.paste)
  const duplicate = useEditor((s) => s.duplicate)
  const remove = useEditor((s) => s.remove)

  const alignDisabled = selection.length < 2
  const distDisabled = selection.length < 3
  const hasSel = selection.length > 0

  return (
    <div className="toolbar align-toolbar">
      <span className="label">{t.align}</span>
      {ALIGN_BUTTONS.map((b) => (
        <button key={b.kind} title={t[b.key]} disabled={alignDisabled} onClick={() => align(b.kind)}>
          {b.glyph}
        </button>
      ))}
      <span className="divider-v" />
      {DISTRIBUTE_BUTTONS.map((b) => (
        <button key={b.kind} title={t[b.key]} disabled={distDisabled} onClick={() => distribute(b.kind)}>
          {b.glyph}
        </button>
      ))}
      <span className="divider-v" />
      <button title={t.copy} disabled={!hasSel} onClick={copy}>
        ⧉
      </button>
      <button title={t.paste} onClick={paste}>
        ▣
      </button>
      <button title={t.duplicate} disabled={!hasSel} onClick={duplicate}>
        ⎘
      </button>
      <button title={t.delete} disabled={!hasSel} onClick={remove}>
        🗑
      </button>
    </div>
  )
}
