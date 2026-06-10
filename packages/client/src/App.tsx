import { useEditor } from './state/editorStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useI18n } from './i18n/I18nContext'
import { LeftPanel } from './panels/left/LeftPanel'
import { PropertyPanel } from './panels/right/PropertyPanel'
import { DeviceToolbar } from './panels/center/DeviceToolbar'
import { AlignToolbar } from './panels/center/AlignToolbar'
import { Canvas } from './panels/center/Canvas'
import { NotesPanel } from './panels/center/NotesPanel'

export function App() {
  useKeyboardShortcuts()
  const { t, lang, setLang } = useI18n()
  const screen = useEditor((s) => s.screen)
  const selection = useEditor((s) => s.selection)
  const saveAsComponent = useEditor((s) => s.saveAsComponent)

  const onSaveComponent = async () => {
    const name = window.prompt(t.promptComponentName)
    if (!name) return
    await saveAsComponent(name.trim())
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">◳ {t.appTitle}</span>
        <span className="spacer" />
        {selection.length > 0 && (
          <button onClick={() => void onSaveComponent()}>{t.groupAsComponent}</button>
        )}
        <span className="lang-switch">
          <button className={lang === 'ko' ? 'active' : ''} onClick={() => setLang('ko')}>
            한국어
          </button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
            EN
          </button>
        </span>
      </header>

      <div className="app-body">
        <LeftPanel />

        <main className="center-panel">
          {screen ? (
            <>
              <DeviceToolbar />
              <AlignToolbar />
              <div className="canvas-area">
                <Canvas />
              </div>
              <NotesPanel />
            </>
          ) : (
            <div className="center-empty">{t.selectScreen}</div>
          )}
        </main>

        <PropertyPanel />
      </div>
    </div>
  )
}
