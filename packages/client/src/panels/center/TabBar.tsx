import { useEditor, type Tab } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'

/** IDE-style tab bar for the open screens and boards. */
export function TabBar() {
  const { t } = useI18n()
  const openTabs = useEditor((s) => s.openTabs)
  const activeTab = useEditor((s) => s.activeTab)
  const screens = useEditor((s) => s.screens)
  const boards = useEditor((s) => s.boards)
  const dirty = useEditor((s) => s.dirty)
  const setActiveTab = useEditor((s) => s.setActiveTab)
  const closeTab = useEditor((s) => s.closeTab)
  const renameDoc = useEditor((s) => s.renameDoc)

  const onRename = (tab: Tab, current: string) => {
    const name = window.prompt(t.rename, current)
    if (name && name.trim()) void renameDoc(tab, name)
  }

  if (openTabs.length === 0) return null

  const nameOf = (tab: Tab) =>
    tab.kind === 'screen' ? screens[tab.id]?.name ?? '…' : boards[tab.id]?.name ?? '…'

  const isActive = (tab: Tab) => activeTab?.kind === tab.kind && activeTab.id === tab.id

  return (
    <div className="tab-bar">
      {openTabs.map((tab) => (
        <div
          key={`${tab.kind}:${tab.id}`}
          className={`doc-tab${isActive(tab) ? ' active' : ''}`}
          onClick={() => setActiveTab(tab)}
          onDoubleClick={() => onRename(tab, nameOf(tab))}
          title={nameOf(tab)}
        >
          <span className="doc-tab-icon">{tab.kind === 'board' ? '🗺' : '🖼'}</span>
          <span className="doc-tab-name">{nameOf(tab)}</span>
          {dirty[tab.id] && <span className="doc-tab-dirty">•</span>}
          <button
            className="doc-tab-x"
            title="Close"
            onClick={(e) => {
              e.stopPropagation()
              closeTab(tab)
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
