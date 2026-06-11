import { useEffect } from 'react'
import { selectActiveBoard, useEditor } from './state/editorStore'
import { useAuth } from './state/authStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCollaboration } from './hooks/useCollaboration'
import { useAutosave } from './hooks/useAutosave'
import { useI18n } from './i18n/I18nContext'
import { AuthScreen } from './panels/AuthScreen'
import { DialogHost } from './panels/DialogHost'
import { ComponentEditor } from './panels/ComponentEditor'
import { LeftPanel } from './panels/left/LeftPanel'
import { PropertyPanel } from './panels/right/PropertyPanel'
import { TabBar } from './panels/center/TabBar'
import { CenterEmpty } from './panels/center/CenterEmpty'
import { BoardView } from './panels/center/BoardView'
import { DeviceToolbar } from './panels/center/DeviceToolbar'
import { AlignToolbar } from './panels/center/AlignToolbar'
import { Canvas } from './panels/center/Canvas'
import { NotesPanel } from './panels/center/NotesPanel'

export function App() {
  const { t, lang, setLang } = useI18n()
  const authReady = useAuth((s) => s.ready)
  const user = useAuth((s) => s.user)
  const initAuth = useAuth((s) => s.init)
  const logout = useAuth((s) => s.logout)

  useEffect(() => {
    void initAuth()
  }, [initAuth])

  useKeyboardShortcuts()
  useCollaboration()
  useAutosave()

  const activeTab = useEditor((s) => s.activeTab)
  const activeBoard = useEditor(selectActiveBoard)
  const componentDraft = useEditor((s) => s.componentDraft)
  const selection = useEditor((s) => s.selection)
  const collaborators = useEditor((s) => s.collaborators)
  const editComponentFromSelection = useEditor((s) => s.editComponentFromSelection)
  const error = useEditor((s) => s.error)
  const setError = useEditor((s) => s.setError)

  // Warn before leaving the page while any open document has unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (Object.values(useEditor.getState().dirty).some(Boolean)) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  if (!authReady) return <div className="center-empty">…</div>
  if (!user) return <AuthScreen />

  const isScreenTab = activeTab?.kind === 'screen'
  const others = collaborators.filter((c) => c.id !== user.id)
  const errorText = error ? (t as Record<string, string>)[error] ?? error : null

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">◳ {t.appTitle}</span>
        <span className="spacer" />
        {selection.length > 0 && !componentDraft && isScreenTab && (
          <button onClick={editComponentFromSelection}>{t.groupAsComponent}</button>
        )}
        {others.length > 0 && (
          <span className="presence" title={others.map((c) => c.email).join(', ')}>
            {others.slice(0, 4).map((c) => (
              <span key={c.id} className="avatar" title={c.email}>
                {c.email[0]?.toUpperCase()}
              </span>
            ))}
            <span className="presence-label">{others.length} {t.editing}</span>
          </span>
        )}
        <span className="lang-switch">
          <button className={lang === 'ko' ? 'active' : ''} onClick={() => setLang('ko')}>
            한국어
          </button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
            EN
          </button>
        </span>
        <span className="user-box">
          <span className="user-email">{user.email}</span>
          <button onClick={logout}>{t.logout}</button>
        </span>
      </header>

      {errorText && (
        <div className="error-banner" role="alert">
          <span>⚠️ {errorText}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="app-body">
        <LeftPanel />

        <main className="center-panel">
          <TabBar />
          {!activeTab ? (
            <CenterEmpty />
          ) : activeBoard ? (
            <BoardView board={activeBoard} />
          ) : isScreenTab ? (
            <>
              <DeviceToolbar />
              <AlignToolbar />
              <div className="canvas-area">
                <Canvas />
              </div>
              <NotesPanel />
            </>
          ) : (
            <CenterEmpty />
          )}
        </main>

        {isScreenTab && <PropertyPanel />}
      </div>

      {componentDraft && <ComponentEditor />}
      <DialogHost />
    </div>
  )
}
