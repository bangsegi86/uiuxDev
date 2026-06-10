import {
  routes,
  type CustomComponent,
  type DeviceKind,
  type NodeInstance,
  type Project,
  type Screen,
  type Template,
  type TreeNode
} from '@uiux/shared'

async function http<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${method} ${url} -> ${res.status} ${text}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  listProjects: () => http<Project[]>('GET', routes.projects),
  createProject: (name: string) => http<Project>('POST', routes.projects, { name }),
  getProject: (id: string) => http<{ project: Project; tree: TreeNode[] }>('GET', routes.project(id)),
  deleteProject: (id: string) => http<void>('DELETE', routes.project(id)),

  listTree: (projectId: string) => http<TreeNode[]>('GET', routes.tree(projectId)),
  createTreeNode: (
    projectId: string,
    input: { type: 'folder' | 'screen'; name: string; parentId?: string | null; device?: DeviceKind }
  ) => http<TreeNode>('POST', routes.tree(projectId), input),
  updateTreeNode: (
    projectId: string,
    nodeId: string,
    patch: { name?: string; parentId?: string | null; order?: number }
  ) => http<TreeNode>('PATCH', routes.treeNode(projectId, nodeId), patch),
  deleteTreeNode: (projectId: string, nodeId: string) =>
    http<void>('DELETE', routes.treeNode(projectId, nodeId)),

  getScreen: (projectId: string, screenId: string) =>
    http<Screen>('GET', routes.screen(projectId, screenId)),
  saveScreen: (projectId: string, screenId: string, patch: Partial<Screen>) =>
    http<Screen>('PUT', routes.screen(projectId, screenId), patch),

  listComponents: (projectId: string) =>
    http<CustomComponent[]>('GET', routes.components(projectId)),
  createComponent: (projectId: string, name: string, definition: NodeInstance) =>
    http<CustomComponent>('POST', routes.components(projectId), { name, definition }),
  deleteComponent: (projectId: string, id: string) =>
    http<void>('DELETE', routes.component(projectId, id)),

  listTemplates: (projectId: string) => http<Template[]>('GET', routes.templates(projectId)),
  createTemplate: (projectId: string, name: string, device: DeviceKind, definition: NodeInstance) =>
    http<Template>('POST', routes.templates(projectId), { name, device, definition }),
  deleteTemplate: (projectId: string, id: string) =>
    http<void>('DELETE', routes.template(projectId, id))
}
