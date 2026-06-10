/** Shared REST route constants and response DTO shapes. */
import type { CustomComponent, Project, ScreenDoc, Template, TreeNode, User } from './models.js'

export const API_BASE = '/api'

export const routes = {
  register: '/api/auth/register',
  login: '/api/auth/login',
  me: '/api/auth/me',
  projects: '/api/projects',
  project: (id: string) => `/api/projects/${id}`,
  tree: (projectId: string) => `/api/projects/${projectId}/tree`,
  treeNode: (projectId: string, nodeId: string) => `/api/projects/${projectId}/tree/${nodeId}`,
  screen: (projectId: string, screenId: string) => `/api/projects/${projectId}/screens/${screenId}`,
  frame: (projectId: string, screenId: string, frameId: string) =>
    `/api/projects/${projectId}/screens/${screenId}/frames/${frameId}`,
  components: (projectId: string) => `/api/projects/${projectId}/components`,
  component: (projectId: string, id: string) => `/api/projects/${projectId}/components/${id}`,
  templates: (projectId: string) => `/api/projects/${projectId}/templates`,
  template: (projectId: string, id: string) => `/api/projects/${projectId}/templates/${id}`,
  health: '/api/health',
  ws: '/api/ws'
} as const

export interface ProjectWithTree {
  project: Project
  tree: TreeNode[]
}

export interface HealthResponse {
  ok: true
  storage: string
}

export interface AuthResponse {
  token: string
  user: User
}

/** Realtime collaboration websocket message protocol. */
export type CollabMessage =
  | { type: 'presence'; users: { id: string; email: string }[] }
  | { type: 'update'; root: NodeInstanceLike; from: string }
  | { type: 'hello'; screenId: string }

/** Loose alias so the protocol type doesn't pull in the full model here. */
export type NodeInstanceLike = unknown

export type { Project, TreeNode, ScreenDoc, CustomComponent, Template, User }
