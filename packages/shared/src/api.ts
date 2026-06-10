/** Shared REST route constants and response DTO shapes. */
import type { CustomComponent, Project, Screen, Template, TreeNode } from './models.js'

export const API_BASE = '/api'

export const routes = {
  projects: '/api/projects',
  project: (id: string) => `/api/projects/${id}`,
  tree: (projectId: string) => `/api/projects/${projectId}/tree`,
  treeNode: (projectId: string, nodeId: string) => `/api/projects/${projectId}/tree/${nodeId}`,
  screen: (projectId: string, screenId: string) => `/api/projects/${projectId}/screens/${screenId}`,
  components: (projectId: string) => `/api/projects/${projectId}/components`,
  component: (projectId: string, id: string) => `/api/projects/${projectId}/components/${id}`,
  templates: (projectId: string) => `/api/projects/${projectId}/templates`,
  template: (projectId: string, id: string) => `/api/projects/${projectId}/templates/${id}`,
  health: '/api/health'
} as const

export interface ProjectWithTree {
  project: Project
  tree: TreeNode[]
}

export interface HealthResponse {
  ok: true
  storage: string
}

export type { Project, TreeNode, Screen, CustomComponent, Template }
