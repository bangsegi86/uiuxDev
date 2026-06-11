import { useState } from 'react'
import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'
import { ProjectExplorer } from './ProjectExplorer'
import { ComponentPalette } from './ComponentPalette'
import { BoardPalette } from './BoardPalette'
import { TemplateLibrary } from './TemplateLibrary'

type Tab = 'explorer' | 'components' | 'templates'

export function LeftPanel() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('explorer')
  const isBoard = useEditor((s) => s.activeTab?.kind === 'board')

  return (
    <aside className="panel left-panel">
      <div className="left-tabs">
        <button className={tab === 'explorer' ? 'active' : ''} onClick={() => setTab('explorer')}>
          {t.explorer}
        </button>
        <button className={tab === 'components' ? 'active' : ''} onClick={() => setTab('components')}>
          {isBoard ? t.boardComponents : t.components}
        </button>
        <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
          {t.templates}
        </button>
      </div>
      {tab === 'explorer' && <ProjectExplorer />}
      {tab === 'components' && (isBoard ? <BoardPalette /> : <ComponentPalette />)}
      {tab === 'templates' && <TemplateLibrary />}
    </aside>
  )
}
