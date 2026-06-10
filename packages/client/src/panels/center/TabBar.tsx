import { useEditor, type Tab } from '../../state/editorStore'

/** IDE-style tab bar for the open screens and boards. */
export function TabBar() {
  const openTabs = useEditor((s) => s.openTabs)
  const activeTab = useEditor((s) => s.activeTab)
  const screens = useEditor((s) => s.screens)
  const boards = useEditor((s) => s.boards)
  const dirty = useEditor((s) => s.dirty)
  const setActiveTab = useEditor((s) => s.setActiveTab)
  const closeTab = useEditor((s) => s.closeTab)

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
