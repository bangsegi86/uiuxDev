import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import {
  customComponentSaveSchema,
  DEVICE_FRAMES,
  emptyRoot,
  projectCreateSchema,
  routes,
  screenSaveSchema,
  templateSaveSchema,
  treeNodeCreateSchema,
  treeNodeUpdateSchema,
  type CustomComponent,
  type Project,
  type Screen,
  type Template,
  type TreeNode
} from '@uiux/shared'
import type { StorageAdapter } from '../storage/index.js'

const now = () => new Date().toISOString()
const id = () => nanoid(12)

/** Register every REST resource. */
export async function registerRoutes(app: FastifyInstance, storage: StorageAdapter) {
  app.get(routes.health, async () => ({ ok: true, storage: storage.name }))

  // --- projects ---
  app.get(routes.projects, async () => storage.listProjects())

  app.post(routes.projects, async (req, reply) => {
    const body = projectCreateSchema.parse(req.body)
    const ts = now()
    const project: Project = { id: id(), name: body.name, createdAt: ts, updatedAt: ts }
    await storage.createProject(project)
    return reply.code(201).send(project)
  })

  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId',
    async (req, reply) => {
      const project = await storage.getProject(req.params.projectId)
      if (!project) return reply.code(404).send({ error: 'project not found' })
      const tree = await storage.listTree(project.id)
      return { project, tree }
    }
  )

  app.delete<{ Params: { projectId: string } }>(
    '/api/projects/:projectId',
    async (req, reply) => {
      await storage.deleteProject(req.params.projectId)
      return reply.code(204).send()
    }
  )

  // --- tree (folders + screen files) ---
  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/tree',
    async (req) => storage.listTree(req.params.projectId)
  )

  app.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/tree',
    async (req, reply) => {
      const { projectId } = req.params
      const body = treeNodeCreateSchema.parse(req.body)
      const siblings = (await storage.listTree(projectId)).filter(
        (n) => n.parentId === (body.parentId ?? null)
      )
      const order = siblings.length
      const node: TreeNode = {
        id: id(),
        projectId,
        parentId: body.parentId ?? null,
        type: body.type,
        name: body.name,
        order
      }
      if (body.type === 'screen') {
        const device = body.device ?? 'pc'
        const frame = DEVICE_FRAMES[device]
        const ts = now()
        const screen: Screen = {
          id: id(),
          name: body.name,
          device,
          canvas: { width: frame.width, height: frame.height },
          root: emptyRoot(device),
          notes: '',
          createdAt: ts,
          updatedAt: ts
        }
        await storage.createScreen(projectId, screen)
        node.screenId = screen.id
      }
      await storage.createTreeNode(node)
      return reply.code(201).send(node)
    }
  )

  app.patch<{ Params: { projectId: string; nodeId: string } }>(
    '/api/projects/:projectId/tree/:nodeId',
    async (req, reply) => {
      const patch = treeNodeUpdateSchema.parse(req.body)
      const updated = await storage.updateTreeNode(req.params.nodeId, patch)
      if (!updated) return reply.code(404).send({ error: 'node not found' })
      // keep the screen name in sync when a screen node is renamed
      if (patch.name && updated.type === 'screen' && updated.screenId) {
        await storage.updateScreen(updated.screenId, { name: patch.name, updatedAt: now() })
      }
      return updated
    }
  )

  app.delete<{ Params: { projectId: string; nodeId: string } }>(
    '/api/projects/:projectId/tree/:nodeId',
    async (req, reply) => {
      await storage.deleteTreeNode(req.params.nodeId)
      return reply.code(204).send()
    }
  )

  // --- screens ---
  app.get<{ Params: { projectId: string; screenId: string } }>(
    '/api/projects/:projectId/screens/:screenId',
    async (req, reply) => {
      const screen = await storage.getScreen(req.params.screenId)
      if (!screen) return reply.code(404).send({ error: 'screen not found' })
      return screen
    }
  )

  app.put<{ Params: { projectId: string; screenId: string } }>(
    '/api/projects/:projectId/screens/:screenId',
    async (req, reply) => {
      const body = screenSaveSchema.parse(req.body)
      const updated = await storage.updateScreen(req.params.screenId, {
        ...(body as Partial<Screen>),
        updatedAt: now()
      })
      if (!updated) return reply.code(404).send({ error: 'screen not found' })
      return updated
    }
  )

  // --- custom components ---
  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/components',
    async (req) => storage.listComponents(req.params.projectId)
  )

  app.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/components',
    async (req, reply) => {
      const body = customComponentSaveSchema.parse(req.body)
      const ts = now()
      const component: CustomComponent = {
        id: id(),
        name: body.name,
        thumbnail: body.thumbnail,
        definition: body.definition as CustomComponent['definition'],
        createdAt: ts,
        updatedAt: ts
      }
      await storage.createComponent(req.params.projectId, component)
      return reply.code(201).send(component)
    }
  )

  app.delete<{ Params: { projectId: string; id: string } }>(
    '/api/projects/:projectId/components/:id',
    async (req, reply) => {
      await storage.deleteComponent(req.params.projectId, req.params.id)
      return reply.code(204).send()
    }
  )

  // --- templates (reusable whole-screen designs) ---
  app.get<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/templates',
    async (req) => storage.listTemplates(req.params.projectId)
  )

  app.post<{ Params: { projectId: string } }>(
    '/api/projects/:projectId/templates',
    async (req, reply) => {
      const body = templateSaveSchema.parse(req.body)
      const ts = now()
      const template: Template = {
        id: id(),
        name: body.name,
        thumbnail: body.thumbnail,
        device: body.device,
        definition: body.definition as Template['definition'],
        createdAt: ts,
        updatedAt: ts
      }
      await storage.createTemplate(req.params.projectId, template)
      return reply.code(201).send(template)
    }
  )

  app.delete<{ Params: { projectId: string; id: string } }>(
    '/api/projects/:projectId/templates/:id',
    async (req, reply) => {
      await storage.deleteTemplate(req.params.projectId, req.params.id)
      return reply.code(204).send()
    }
  )
}
