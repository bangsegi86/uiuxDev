import type { FastifyInstance, FastifyRequest } from 'fastify'
import { nanoid } from 'nanoid'
import {
  authSchema,
  boardSaveSchema,
  customComponentSaveSchema,
  DEVICE_FRAMES,
  emptyRoot,
  projectCreateSchema,
  projectUpdateSchema,
  routes,
  screenSaveSchema,
  templateSaveSchema,
  treeNodeCreateSchema,
  treeNodeUpdateSchema,
  type Board,
  type CustomComponent,
  type Project,
  type Screen,
  type Template,
  type TreeNode
} from '@uiux/shared'
import { hashPassword, signToken, userFromAuthHeader, verifyPassword } from '../auth.js'
import { boardInProject, screenInProject } from '../access.js'
import { readUpload, saveDataUrl } from '../uploads.js'
import type { StorageAdapter } from '../storage/index.js'

const now = () => new Date().toISOString()
const id = () => nanoid(12)

/** Read the authenticated user id attached by the project-routes guard. */
const uid = (req: FastifyRequest): string => (req as { userId?: string }).userId ?? ''

/** Register every REST resource. */
export async function registerRoutes(app: FastifyInstance, storage: StorageAdapter) {
  app.get(routes.health, async () => ({ ok: true, storage: storage.name }))

  // --- auth (public) ---
  app.post(routes.register, async (req, reply) => {
    const { email, password } = authSchema.parse(req.body)
    if (await storage.getUserByEmail(email)) {
      return reply.code(409).send({ error: 'email already registered' })
    }
    const user = await storage.createUser({
      id: id(),
      email,
      passwordHash: hashPassword(password),
      createdAt: now()
    })
    const pub = { id: user.id, email: user.email, createdAt: user.createdAt }
    return reply.code(201).send({ token: signToken(user), user: pub })
  })

  app.post(routes.login, async (req, reply) => {
    const { email, password } = authSchema.parse(req.body)
    const user = await storage.getUserByEmail(email)
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: 'invalid credentials' })
    }
    const pub = { id: user.id, email: user.email, createdAt: user.createdAt }
    return { token: signToken(user), user: pub }
  })

  app.get(routes.me, async (req, reply) => {
    const payload = userFromAuthHeader(req.headers.authorization)
    if (!payload) return reply.code(401).send({ error: 'unauthorized' })
    const user = await storage.getUserById(payload.sub)
    if (!user) return reply.code(401).send({ error: 'unauthorized' })
    return { id: user.id, email: user.email, createdAt: user.createdAt }
  })

  // --- auth guard for all project-scoped routes ---
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api/projects')) return
    const payload = userFromAuthHeader(req.headers.authorization)
    if (!payload) return reply.code(401).send({ error: 'unauthorized' })
    ;(req as { userId?: string }).userId = payload.sub
    // When a specific project is addressed, enforce ownership.
    const m = /^\/api\/projects\/([^/?]+)/.exec(req.url)
    if (m) {
      const project = await storage.getProject(decodeURIComponent(m[1]))
      if (!project) return reply.code(404).send({ error: 'project not found' })
      if (project.ownerId && project.ownerId !== payload.sub) {
        return reply.code(403).send({ error: 'forbidden' })
      }
    }
  })

  // --- projects ---
  app.get(routes.projects, async (req) => {
    const userId = uid(req)
    const all = await storage.listProjects()
    // Show the user's own projects (and legacy ones without an owner).
    return all.filter((p) => !p.ownerId || p.ownerId === userId)
  })

  app.post(routes.projects, async (req, reply) => {
    const body = projectCreateSchema.parse(req.body)
    const ts = now()
    const project: Project = { id: id(), name: body.name, ownerId: uid(req), createdAt: ts, updatedAt: ts }
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

  app.put<{ Params: { projectId: string } }>(
    '/api/projects/:projectId',
    async (req, reply) => {
      const body = projectUpdateSchema.parse(req.body)
      const updated = await storage.updateProject(req.params.projectId, {
        ...(body as Partial<Project>),
        updatedAt: now()
      })
      if (!updated) return reply.code(404).send({ error: 'project not found' })
      return updated
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
      } else if (body.type === 'board') {
        const ts = now()
        const board: Board = {
          id: id(),
          name: body.name,
          items: [],
          connectors: [],
          elements: [],
          notes: '',
          createdAt: ts,
          updatedAt: ts
        }
        await storage.createBoard(projectId, board)
        node.boardId = board.id
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
      if (!(await screenInProject(storage, req.params.projectId, req.params.screenId))) {
        return reply.code(404).send({ error: 'screen not found' })
      }
      const screen = await storage.getScreen(req.params.screenId)
      if (!screen) return reply.code(404).send({ error: 'screen not found' })
      return screen
    }
  )

  app.put<{ Params: { projectId: string; screenId: string } }>(
    '/api/projects/:projectId/screens/:screenId',
    async (req, reply) => {
      if (!(await screenInProject(storage, req.params.projectId, req.params.screenId))) {
        return reply.code(404).send({ error: 'screen not found' })
      }
      const body = screenSaveSchema.parse(req.body)
      const updated = await storage.updateScreen(req.params.screenId, {
        ...(body as Partial<Screen>),
        updatedAt: now()
      })
      if (!updated) return reply.code(404).send({ error: 'screen not found' })
      return updated
    }
  )

  // --- boards (flow diagrams) ---
  app.get<{ Params: { projectId: string; boardId: string } }>(
    '/api/projects/:projectId/boards/:boardId',
    async (req, reply) => {
      if (!(await boardInProject(storage, req.params.projectId, req.params.boardId))) {
        return reply.code(404).send({ error: 'board not found' })
      }
      const board = await storage.getBoard(req.params.boardId)
      if (!board) return reply.code(404).send({ error: 'board not found' })
      return board
    }
  )

  app.put<{ Params: { projectId: string; boardId: string } }>(
    '/api/projects/:projectId/boards/:boardId',
    async (req, reply) => {
      if (!(await boardInProject(storage, req.params.projectId, req.params.boardId))) {
        return reply.code(404).send({ error: 'board not found' })
      }
      const body = boardSaveSchema.parse(req.body)
      const updated = await storage.updateBoard(req.params.boardId, {
        ...(body as Partial<Board>),
        updatedAt: now()
      })
      if (!updated) return reply.code(404).send({ error: 'board not found' })
      return updated
    }
  )

  // --- uploads (images) ---
  app.post<{ Params: { projectId: string }; Body: { dataUrl?: string } }>(
    '/api/projects/:projectId/uploads',
    { bodyLimit: 12 * 1024 * 1024 },
    async (req, reply) => {
      const dataUrl = req.body?.dataUrl
      if (typeof dataUrl !== 'string') return reply.code(400).send({ error: 'dataUrl required' })
      try {
        const url = await saveDataUrl(req.params.projectId, dataUrl)
        return reply.code(201).send({ url })
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message })
      }
    }
  )

  // Public (no auth) so <img src> can load it; ids are unguessable.
  app.get<{ Params: { projectId: string; file: string } }>(
    '/api/uploads/:projectId/:file',
    async (req, reply) => {
      const found = await readUpload(req.params.projectId, req.params.file)
      if (!found) return reply.code(404).send({ error: 'not found' })
      return reply.header('Cache-Control', 'public, max-age=31536000, immutable').type(found.mime).send(found.buf)
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

  app.put<{ Params: { projectId: string; id: string } }>(
    '/api/projects/:projectId/components/:id',
    async (req, reply) => {
      const body = customComponentSaveSchema.parse(req.body)
      const updated = await storage.updateComponent(req.params.projectId, req.params.id, {
        name: body.name,
        thumbnail: body.thumbnail,
        definition: body.definition as CustomComponent['definition'],
        updatedAt: now()
      })
      if (!updated) return reply.code(404).send({ error: 'component not found' })
      return updated
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
