import type {
  CustomComponent,
  Project,
  Screen,
  Template,
  TreeNode
} from '@uiux/shared'

/**
 * A storage adapter provides persistence for every resource in the builder.
 * Implementations: LocalFileAdapter (JSON on disk) and KnexAdapter (SQL).
 * Both must behave identically so the rest of the server is storage-agnostic.
 */
export interface StorageAdapter {
  readonly name: string
  init(): Promise<void>

  // Projects
  listProjects(): Promise<Project[]>
  getProject(id: string): Promise<Project | null>
  createProject(p: Project): Promise<Project>
  updateProject(id: string, patch: Partial<Project>): Promise<Project | null>
  deleteProject(id: string): Promise<void>

  // Tree (folders + screen files)
  listTree(projectId: string): Promise<TreeNode[]>
  getTreeNode(id: string): Promise<TreeNode | null>
  createTreeNode(node: TreeNode): Promise<TreeNode>
  updateTreeNode(id: string, patch: Partial<TreeNode>): Promise<TreeNode | null>
  deleteTreeNode(id: string): Promise<void>

  // Screens
  getScreen(id: string): Promise<Screen | null>
  createScreen(projectId: string, screen: Screen): Promise<Screen>
  updateScreen(id: string, patch: Partial<Screen>): Promise<Screen | null>
  deleteScreen(id: string): Promise<void>

  // Custom components
  listComponents(projectId: string): Promise<CustomComponent[]>
  createComponent(projectId: string, c: CustomComponent): Promise<CustomComponent>
  deleteComponent(projectId: string, id: string): Promise<void>

  // Templates
  listTemplates(projectId: string): Promise<Template[]>
  createTemplate(projectId: string, t: Template): Promise<Template>
  deleteTemplate(projectId: string, id: string): Promise<void>
}
