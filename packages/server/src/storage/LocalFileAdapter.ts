import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  CustomComponent,
  Project,
  Screen,
  Template,
  TreeNode
} from '@uiux/shared'
import type { StorageAdapter, StoredUser } from './StorageAdapter.js'

/**
 * Default adapter. Persists everything as JSON under a data directory:
 *
 *   data/
 *     projects.json                  // index of projects
 *     <projectId>/
 *       tree.json                    // folder/screen tree
 *       components.json              // custom components
 *       templates.json               // screen templates
 *       screens/<screenId>.json      // one file per screen design
 *
 * The on-disk folder layout intentionally mirrors the in-app file explorer.
 */
export class LocalFileAdapter implements StorageAdapter {
  readonly name = 'local'
  private root: string

  constructor(dataDir: string) {
    this.root = dataDir
  }

  async init(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true })
    await this.ensureFile(this.projectsFile(), [])
    await this.ensureFile(this.usersFile(), [])
  }

  // --- path helpers ---
  private usersFile() {
    return path.join(this.root, 'users.json')
  }
  private projectsFile() {
    return path.join(this.root, 'projects.json')
  }
  private projectDir(projectId: string) {
    return path.join(this.root, projectId)
  }
  private treeFile(projectId: string) {
    return path.join(this.projectDir(projectId), 'tree.json')
  }
  private componentsFile(projectId: string) {
    return path.join(this.projectDir(projectId), 'components.json')
  }
  private templatesFile(projectId: string) {
    return path.join(this.projectDir(projectId), 'templates.json')
  }
  private screensDir(projectId: string) {
    return path.join(this.projectDir(projectId), 'screens')
  }
  private screenFile(projectId: string, screenId: string) {
    return path.join(this.screensDir(projectId), `${screenId}.json`)
  }

  // --- low-level json io ---
  private async readJson<T>(file: string, fallback: T): Promise<T> {
    try {
      const raw = await fs.readFile(file, 'utf8')
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }
  private async writeJson(file: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8')
  }
  private async ensureFile(file: string, fallback: unknown): Promise<void> {
    try {
      await fs.access(file)
    } catch {
      await this.writeJson(file, fallback)
    }
  }

  /** Screens are stored per-project but looked up by id; remember the mapping. */
  private async findScreenProject(screenId: string): Promise<string | null> {
    const projects = await this.listProjects()
    for (const p of projects) {
      const file = this.screenFile(p.id, screenId)
      try {
        await fs.access(file)
        return p.id
      } catch {
        // not in this project
      }
    }
    return null
  }

  // --- users ---
  async createUser(user: StoredUser): Promise<StoredUser> {
    const users = await this.readJson<StoredUser[]>(this.usersFile(), [])
    users.push(user)
    await this.writeJson(this.usersFile(), users)
    return user
  }
  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const users = await this.readJson<StoredUser[]>(this.usersFile(), [])
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
  }
  async getUserById(id: string): Promise<StoredUser | null> {
    const users = await this.readJson<StoredUser[]>(this.usersFile(), [])
    return users.find((u) => u.id === id) ?? null
  }

  // --- projects ---
  async listProjects(): Promise<Project[]> {
    return this.readJson<Project[]>(this.projectsFile(), [])
  }
  async getProject(id: string): Promise<Project | null> {
    return (await this.listProjects()).find((p) => p.id === id) ?? null
  }
  async createProject(p: Project): Promise<Project> {
    const projects = await this.listProjects()
    projects.push(p)
    await this.writeJson(this.projectsFile(), projects)
    await this.writeJson(this.treeFile(p.id), [])
    await this.writeJson(this.componentsFile(p.id), [])
    await this.writeJson(this.templatesFile(p.id), [])
    await fs.mkdir(this.screensDir(p.id), { recursive: true })
    return p
  }
  async updateProject(id: string, patch: Partial<Project>): Promise<Project | null> {
    const projects = await this.listProjects()
    const idx = projects.findIndex((p) => p.id === id)
    if (idx < 0) return null
    projects[idx] = { ...projects[idx], ...patch, id }
    await this.writeJson(this.projectsFile(), projects)
    return projects[idx]
  }
  async deleteProject(id: string): Promise<void> {
    const projects = (await this.listProjects()).filter((p) => p.id !== id)
    await this.writeJson(this.projectsFile(), projects)
    await fs.rm(this.projectDir(id), { recursive: true, force: true })
  }

  // --- tree ---
  async listTree(projectId: string): Promise<TreeNode[]> {
    return this.readJson<TreeNode[]>(this.treeFile(projectId), [])
  }
  async getTreeNode(id: string): Promise<TreeNode | null> {
    const projects = await this.listProjects()
    for (const p of projects) {
      const node = (await this.listTree(p.id)).find((n) => n.id === id)
      if (node) return node
    }
    return null
  }
  async createTreeNode(node: TreeNode): Promise<TreeNode> {
    const tree = await this.listTree(node.projectId)
    tree.push(node)
    await this.writeJson(this.treeFile(node.projectId), tree)
    return node
  }
  async updateTreeNode(id: string, patch: Partial<TreeNode>): Promise<TreeNode | null> {
    const node = await this.getTreeNode(id)
    if (!node) return null
    const tree = await this.listTree(node.projectId)
    const idx = tree.findIndex((n) => n.id === id)
    tree[idx] = { ...tree[idx], ...patch, id, projectId: node.projectId }
    await this.writeJson(this.treeFile(node.projectId), tree)
    return tree[idx]
  }
  async deleteTreeNode(id: string): Promise<void> {
    const node = await this.getTreeNode(id)
    if (!node) return
    // collect node + descendants
    const tree = await this.listTree(node.projectId)
    const toRemove = new Set<string>([id])
    let changed = true
    while (changed) {
      changed = false
      for (const n of tree) {
        if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
          toRemove.add(n.id)
          changed = true
        }
      }
    }
    const remaining = tree.filter((n) => !toRemove.has(n.id))
    await this.writeJson(this.treeFile(node.projectId), remaining)
    for (const n of tree) {
      if (toRemove.has(n.id) && n.type === 'screen' && n.screenId) {
        await fs.rm(this.screenFile(node.projectId, n.screenId), { force: true })
      }
    }
  }

  // --- screens ---
  async getScreen(id: string): Promise<Screen | null> {
    const projectId = await this.findScreenProject(id)
    if (!projectId) return null
    return this.readJson<Screen | null>(this.screenFile(projectId, id), null)
  }
  async createScreen(projectId: string, screen: Screen): Promise<Screen> {
    await this.writeJson(this.screenFile(projectId, screen.id), screen)
    return screen
  }
  async updateScreen(id: string, patch: Partial<Screen>): Promise<Screen | null> {
    const projectId = await this.findScreenProject(id)
    if (!projectId) return null
    const current = await this.readJson<Screen | null>(this.screenFile(projectId, id), null)
    if (!current) return null
    const next = { ...current, ...patch, id }
    await this.writeJson(this.screenFile(projectId, id), next)
    return next
  }
  async deleteScreen(id: string): Promise<void> {
    const projectId = await this.findScreenProject(id)
    if (!projectId) return
    await fs.rm(this.screenFile(projectId, id), { force: true })
  }

  // --- components ---
  async listComponents(projectId: string): Promise<CustomComponent[]> {
    return this.readJson<CustomComponent[]>(this.componentsFile(projectId), [])
  }
  async createComponent(projectId: string, c: CustomComponent): Promise<CustomComponent> {
    const list = await this.listComponents(projectId)
    list.push(c)
    await this.writeJson(this.componentsFile(projectId), list)
    return c
  }
  async deleteComponent(projectId: string, id: string): Promise<void> {
    const list = (await this.listComponents(projectId)).filter((c) => c.id !== id)
    await this.writeJson(this.componentsFile(projectId), list)
  }

  // --- templates ---
  async listTemplates(projectId: string): Promise<Template[]> {
    return this.readJson<Template[]>(this.templatesFile(projectId), [])
  }
  async createTemplate(projectId: string, t: Template): Promise<Template> {
    const list = await this.listTemplates(projectId)
    list.push(t)
    await this.writeJson(this.templatesFile(projectId), list)
    return t
  }
  async deleteTemplate(projectId: string, id: string): Promise<void> {
    const list = (await this.listTemplates(projectId)).filter((t) => t.id !== id)
    await this.writeJson(this.templatesFile(projectId), list)
  }
}
