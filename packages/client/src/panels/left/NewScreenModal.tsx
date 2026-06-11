import { useState } from 'react'
import { DEVICE_FRAMES, type DeviceKind } from '@uiux/shared'
import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'

/** Dialog to create a screen: name + device (PC/Mobile) + canvas size. */
export function NewScreenModal({ parentId, onClose }: { parentId: string | null; onClose: () => void }) {
  const { t } = useI18n()
  const createNode = useEditor((s) => s.createNode)
  const [name, setName] = useState('')
  const [device, setDevice] = useState<DeviceKind>('pc')
  const [width, setWidth] = useState(DEVICE_FRAMES.pc.width)
  const [height, setHeight] = useState(DEVICE_FRAMES.pc.height)

  const pickDevice = (d: DeviceKind) => {
    setDevice(d)
    setWidth(DEVICE_FRAMES[d].width)
    setHeight(DEVICE_FRAMES[d].height)
  }

  const onCreate = async () => {
    const n = name.trim()
    if (!n) return
    await createNode('screen', n, parentId, device, { width, height })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box new-screen-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{t.newScreen}</strong>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <label className="field">
          <span>{t.promptScreenName}</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void onCreate()}
          />
        </label>

        <label className="field">
          <span>{t.device}</span>
          <div className="segmented">
            <button className={device === 'pc' ? 'active' : ''} onClick={() => pickDevice('pc')}>
              🖥 {t.pc}
            </button>
            <button className={device === 'mobile' ? 'active' : ''} onClick={() => pickDevice('mobile')}>
              📱 {t.mobile}
            </button>
          </div>
        </label>

        <div className="xy-grid">
          <label className="field inline">
            <span>{t.width}</span>
            <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
          </label>
          <label className="field inline">
            <span>{t.height}</span>
            <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
          </label>
        </div>

        <div className="modal-foot">
          <span className="spacer" />
          <button onClick={onClose}>{t.cancel}</button>
          <button className="primary" disabled={!name.trim()} onClick={() => void onCreate()}>
            {t.create}
          </button>
        </div>
      </div>
    </div>
  )
}
