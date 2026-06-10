import type { Knex } from 'knex'
import type {
  CustomComponent,
  Project,
  ScreenDoc,
  Template,
  TreeNode
} from '@uiux/shared'
import type { StorageAdapter, StoredUser } from './StorageAdapter.js'

/**
 * SQL-backed adapter (PostgreSQL or Oracle) using Knex. Definitions and other
 * nested objects are stored as JSON text columns so the same schema works
 * across both engines without engine-specific JSON types.
 */
export class KnexAdapter implements StorageAdapter {
  readonly name: string
  private db: Knex

  constructor(db: Knex, name: string) {
    this.db = db
    this.name = name
  }

  async init(): Promise<void> {
    await this.db.migrate.latest()
  }

  private parse<T>(value: unknown): T {
    return typeof value === 'string' ? (JSON.parse(value) as T) : (value as T)
  }

  // --- users ---
  async createUser(user: StoredUser): Promise<StoredUser> {
    await this.db('users').insert(user)
    return user
  }
  async getUserByEmail(email: string): Promise<StoredUser | null> {
    return (
      (await this.db<StoredUser>('users').whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first()) ??
      null
    )
  }
  async getUserById(id: string): Promise<StoredUser | null> {
    return (await this.db<StoredUser>('users').where({ id }).first()) ?? null
  }

  // --- projects ---
  async listProjects(): Promise<Project[]> {
    return this.db<Project>('projects').select('*').orderBy('createdAt')
  }
  async getProject(id: string): Promise<Project | null> {
    return (await this.db<Project>('projects').where({ id }).first()) ?? null
  }
  async createProject(p: Project): Promise<Project> {
    await this.db('projects').insert(p)
    return p
  }
  async updateProject(id: string, patch: Partial<Project>): Promise<Project | null> {
    await this.db('projects').where({ id }).update(patch)
    return this.getProject(id)
  }
  async deleteProject(id: string): Promise<void> {
    await this.db('templates').where({ projectId: id }).del()
    await this.db('custom_components').where({ projectId: id }).del()
    await this.db('screens').where({ projectId: id }).del()
    await this.db('tree_nodes').where({ projectId: id }).del()
    await this.db('projects').where({ id }).del()
  }

  // --- tree ---
  async listTree(projectId: string): Promise<TreeNode[]> {
    return this.db<TreeNode>('tree_nodes').where({ projectId }).orderBy('order')
  }
  async getTreeNode(id: string): Promise<TreeNode | null> {
    return (await this.db<TreeNode>('tree_nodes').where({ id }).first()) ?? null
  }
  async createTreeNode(node: TreeNode): Promise<TreeNode> {
    await this.db('tree_nodes').insert(node)
    return node
  }
  async updateTreeNode(id: string, patch: Partial<TreeNode>): Promise<TreeNode | null> {
    await this.db('tree_nodes').where({ id }).update(patch)
    return this.getTreeNode(id)
  }
  async deleteTreeNode(id: string): Promise<void> {
    const node = await this.getTreeNode(id)
    if (!node) return
    const all = await this.listTree(node.projectId)
    const toRemove = new Set<string>([id])
    let changed = true
    while (changed) {
      changed = false
      for (const n of all) {
        if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
          toRemove.add(n.id)
          changed = true
        }
      }
    }
    const screenIds = all
      .filter((n) => toRemove.has(n.id) && n.type === 'screen' && n.screenId)
      .map((n) => n.screenId as string)
    if (screenIds.length) await this.db('screens').whereIn('id', screenIds).del()
    await this.db('tree_nodes').whereIn('id', [...toRemove]).del()
  }

  // --- screen documents ---
  async getScreen(id: string): Promise<ScreenDoc | null> {
    const row = await this.db('screens').where({ id }).first()
    if (!row) return null
    return this.rowToScreen(row)
  }
  async createScreen(projectId: string, screen: ScreenDoc): Promise<ScreenDoc> {
    await this.db('screens').insert(this.screenToRow(projectId, screen))
    return screen
  }
  async updateScreen(id: string, patch: Partial<ScreenDoc>): Promise<ScreenDoc | null> {
    const current = await this.getScreen(id)
    if (!current) return null
    const next = { ...current, ...patch, id }
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = next.name
    if (patch.frames !== undefined) row.frames = JSON.stringify(next.frames)
    if (patch.connectors !== undefined) row.connectors = JSON.stringify(next.connectors)
    if (patch.notes !== undefined) row.notes = next.notes
    row.updatedAt = next.updatedAt
    await this.db('screens').where({ id }).update(row)
    return next
  }
  async deleteScreen(id: string): Promise<void> {
    await this.db('screens').where({ id }).del()
  }
  private screenToRow(projectId: string, s: ScreenDoc) {
    return {
      id: s.id,
      projectId,
      name: s.name,
      frames: JSON.stringify(s.frames),
      connectors: JSON.stringify(s.connectors),
      notes: s.notes,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }
  }
  private rowToScreen(row: Record<string, unknown>): ScreenDoc {
    return {
      id: row.id as string,
      name: row.name as string,
      frames: this.parse(row.frames),
      connectors: this.parse(row.connectors ?? '[]'),
      notes: (row.notes as string) ?? '',
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string
    }
  }

  // --- components ---
  async listComponents(projectId: string): Promise<CustomComponent[]> {
    const rows = await this.db('custom_components').where({ projectId }).orderBy('createdAt')
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      thumbnail: r.thumbnail ?? undefined,
      definition: this.parse(r.definition),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  }
  async createComponent(projectId: string, c: CustomComponent): Promise<CustomComponent> {
    await this.db('custom_components').insert({
      id: c.id,
      projectId,
      name: c.name,
      thumbnail: c.thumbnail ?? null,
      definition: JSON.stringify(c.definition),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    })
    return c
  }
  async updateComponent(
    projectId: string,
    id: string,
    patch: Partial<CustomComponent>
  ): Promise<CustomComponent | null> {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.thumbnail !== undefined) row.thumbnail = patch.thumbnail ?? null
    if (patch.definition !== undefined) row.definition = JSON.stringify(patch.definition)
    if (patch.updatedAt !== undefined) row.updatedAt = patch.updatedAt
    if (Object.keys(row).length) await this.db('custom_components').where({ projectId, id }).update(row)
    const found = (await this.listComponents(projectId)).find((c) => c.id === id)
    return found ?? null
  }
  async deleteComponent(projectId: string, id: string): Promise<void> {
    await this.db('custom_components').where({ projectId, id }).del()
  }

  // --- templates ---
  async listTemplates(projectId: string): Promise<Template[]> {
    const rows = await this.db('templates').where({ projectId }).orderBy('createdAt')
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      thumbnail: r.thumbnail ?? undefined,
      device: r.device,
      definition: this.parse(r.definition),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }))
  }
  async createTemplate(projectId: string, t: Template): Promise<Template> {
    await this.db('templates').insert({
      id: t.id,
      projectId,
      name: t.name,
      thumbnail: t.thumbnail ?? null,
      device: t.device,
      definition: JSON.stringify(t.definition),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    })
    return t
  }
  async deleteTemplate(projectId: string, id: string): Promise<void> {
    await this.db('templates').where({ projectId, id }).del()
  }
}
