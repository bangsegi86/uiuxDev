import { useEffect, useState } from 'react'
import type { Project, TreeNode } from '@uiux/shared'
import { useEditor } from '../../state/editorStore'
import { useI18n } from '../../i18n/I18nContext'

export function ProjectExplorer() {
  const { t } = useI18n()
  const projectId = useEditor((s) => s.projectId)
  const projectName = useEditor((s) => s.projectName)
  const tree = useEditor((s) => s.tree)
  const screen = useEditor((s) => s.screen)
  const loadProjects = useEditor((s) => s.loadProjects)
  const openProject = useEditor((s) => s.openProject)
  const createProject = useEditor((s) => s.createProject)
  const createNode = useEditor((s) => s.createNode)
  const renameNode = useEditor((s) => s.renameNode)
  const deleteNode = useEditor((s) => s.deleteNode)
  const openScreen = useEditor((s) => s.openScreen)

  const [projects, setProjects] = useState<Project[]>([])

  const refreshProjects = async () => setProjects(await loadProjects())
  useEffect(() => {
    void refreshProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onNewProject = async () => {
    const name = window.prompt(t.promptProjectName)
    if (!name) return
    await createProject(name.trim())
    await refreshProjects()
  }

  const onNewFolder = async (parentId: string | null) => {
    const name = window.prompt(t.promptFolderName)
    if (!name) return
    await createNode('folder', name.trim(), parentId)
  }

  const onNewScreen = async (parentId: string | null) => {
    const name = window.prompt(t.promptScreenName)
    if (!name) return
    const device = window.confirm('PC = OK / Mobile = Cancel') ? 'pc' : 'mobile'
    await createNode('screen', name.trim(), parentId, device)
  }

  const onRename = async (node: TreeNode) => {
    const name = window.prompt(t.rename, node.name)
    if (!name) return
    await renameNode(node.id, name.trim())
  }

  const onDelete = async (node: TreeNode) => {
    if (!window.confirm(t.confirmDelete)) return
    await deleteNode(node.id)
  }

  const childrenOf = (parentId: string | null) =>
    tree.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order)

  const renderNodes = (parentId: string | null, depth: number): React.ReactNode =>
    childrenOf(parentId).map((node) => (
      <div key={node.id}>
        <div
          className={`tree-row${screen?.id === node.screenId && node.type === 'screen' ? ' active' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => node.type === 'screen' && node.screenId && void openScreen(node.screenId)}
        >
          <span className="tree-icon">{node.type === 'folder' ? '📁' : '📄'}</span>
          <span className="tree-name">{node.name}</span>
          <span className="tree-actions">
            {node.type === 'folder' && (
              <>
                <button title={t.newFolder} onClick={(e) => { e.stopPropagation(); void onNewFolder(node.id) }}>＋📁</button>
                <button title={t.newScreen} onClick={(e) => { e.stopPropagation(); void onNewScreen(node.id) }}>＋📄</button>
              </>
            )}
            <button title={t.rename} onClick={(e) => { e.stopPropagation(); void onRename(node) }}>✎</button>
            <button title={t.delete} onClick={(e) => { e.stopPropagation(); void onDelete(node) }}>×</button>
          </span>
        </div>
        {node.type === 'folder' && renderNodes(node.id, depth + 1)}
      </div>
    ))

  return (
    <div className="left-tab-body">
      <div className="explorer-head">
        <select
          value={projectId ?? ''}
          onChange={(e) => e.target.value && void openProject(e.target.value)}
        >
          <option value="" disabled>
            {t.projects}…
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="icon-btn" title={t.newProject} onClick={() => void onNewProject()}>
          ＋
        </button>
      </div>

      {projectId ? (
        <>
          <div className="explorer-toolbar">
            <span className="explorer-project">{projectName}</span>
            <span className="spacer" />
            <button title={t.newFolder} onClick={() => void onNewFolder(null)}>＋📁</button>
            <button title={t.newScreen} onClick={() => void onNewScreen(null)}>＋📄</button>
          </div>
          <div className="tree">{renderNodes(null, 0)}</div>
        </>
      ) : (
        <div className="empty-hint">{t.newProject} ＋</div>
      )}
    </div>
  )
}
