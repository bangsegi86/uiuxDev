/** Zod validators mirroring the domain models, used by the server routes. */
import { z } from 'zod'

export const deviceKindSchema = z.enum(['pc', 'mobile'])

export const layoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number()
})

/** NodeInstance is recursive, so the schema is declared lazily. */
export const nodeInstanceSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.string(),
    props: z.record(z.unknown()),
    style: z.record(z.string()),
    layout: layoutSchema,
    children: z.array(nodeInstanceSchema)
  })
)

export const authSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200)
})

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(200)
})

export const treeNodeCreateSchema = z.object({
  parentId: z.string().nullable().optional(),
  type: z.enum(['folder', 'screen', 'board']),
  name: z.string().min(1).max(200),
  device: deviceKindSchema.optional()
})

export const treeNodeUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  parentId: z.string().nullable().optional(),
  order: z.number().optional()
})

export const connectorSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string().optional()
})

export const boardItemSchema = z.object({
  screenId: z.string(),
  x: z.number(),
  y: z.number()
})

export const boardElementSchema = z.object({
  id: z.string(),
  kind: z.enum(['memo', 'text', 'image']),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  text: z.string().optional(),
  src: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  align: z.enum(['left', 'center', 'right']).optional()
})

/** Save a single screen design. */
export const screenSaveSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  device: deviceKindSchema.optional(),
  canvas: z.object({ width: z.number(), height: z.number() }).optional(),
  root: nodeInstanceSchema.optional(),
  notes: z.string().optional()
})

/** Save a flow board (placed screens + connectors). */
export const boardSaveSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().optional(),
  items: z.array(boardItemSchema).optional(),
  connectors: z.array(connectorSchema).optional(),
  elements: z.array(boardElementSchema).optional()
})

export const customComponentSaveSchema = z.object({
  name: z.string().min(1).max(200),
  thumbnail: z.string().optional(),
  definition: nodeInstanceSchema
})

export const templateSaveSchema = z.object({
  name: z.string().min(1).max(200),
  thumbnail: z.string().optional(),
  device: deviceKindSchema,
  definition: nodeInstanceSchema
})

export type AuthInput = z.infer<typeof authSchema>
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>
export type TreeNodeCreateInput = z.infer<typeof treeNodeCreateSchema>
export type TreeNodeUpdateInput = z.infer<typeof treeNodeUpdateSchema>
export type ScreenSaveInput = z.infer<typeof screenSaveSchema>
export type BoardSaveInput = z.infer<typeof boardSaveSchema>
export type CustomComponentSaveInput = z.infer<typeof customComponentSaveSchema>
export type TemplateSaveInput = z.infer<typeof templateSaveSchema>
