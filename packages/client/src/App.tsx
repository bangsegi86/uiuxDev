import { useEffect } from 'react'
import { useEditor } from './state/editorStore'
import { useAuth } from './state/authStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useCollaboration } from './hooks/useCollaboration'
import { useI18n } from './i18n/I18nContext'
import { AuthScreen } from './panels/AuthScreen'
import { ComponentEditor } from './panels/ComponentEditor'
import { LeftPanel } from './panels/left/LeftPanel'
import { PropertyPanel } from './panels/right/PropertyPanel'
import { FrameTabs } from './panels/center/FrameTabs'
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

  const doc = useEditor((s) => s.doc)
  const activeFrameId = useEditor((s) => s.activeFrameId)
  const view = useEditor((s) => s.view)
  const componentDraft = useEditor((s) => s.componentDraft)
  const selection = useEditor((s) => s.selection)
  const collaborators = useEditor((s) => s.collaborators)
  const editComponentFromSelection = useEditor((s) => s.editComponentFromSelection)

  if (!authReady) return <div className="center-empty">…</div>
  if (!user) return <AuthScreen />

  const hasActiveFrame = !!doc && !!activeFrameId

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">◳ {t.appTitle}</span>
        <span className="spacer" />
        {selection.length > 0 && !componentDraft && (
          <button onClick={editComponentFromSelection}>{t.groupAsComponent}</button>
        )}
        {collaborators.length > 1 && (
          <span className="presence" title={collaborators.map((c) => c.email).join(', ')}>
            {collaborators.slice(0, 4).map((c) => (
              <span key={c.id} className="avatar" title={c.email}>
                {c.email[0]?.toUpperCase()}
              </span>
            ))}
            <span className="presence-label">{collaborators.length} {t.editing}</span>
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

      <div className="app-body">
        <LeftPanel />

        <main className="center-panel">
          {doc ? (
            <>
              <FrameTabs />
              {view === 'board' ? (
                <BoardView />
              ) : hasActiveFrame ? (
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
            </>
          ) : (
            <div className="center-empty">{t.selectScreen}</div>
          )}
        </main>

        <PropertyPanel />
      </div>

      {componentDraft && <ComponentEditor />}
    </div>
  )
}
