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
  type: z.enum(['folder', 'screen']),
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

export const frameSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  device: deviceKindSchema,
  canvas: z.object({ width: z.number(), height: z.number() }),
  root: nodeInstanceSchema,
  board: z.object({ x: z.number(), y: z.number() })
})

/** Save the whole document (frames + connectors + notes). */
export const screenSaveSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().optional(),
  frames: z.array(frameSchema).optional(),
  connectors: z.array(connectorSchema).optional()
})

/** Save a single frame in place. */
export const frameSaveSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  device: deviceKindSchema.optional(),
  canvas: z.object({ width: z.number(), height: z.number() }).optional(),
  root: nodeInstanceSchema.optional(),
  board: z.object({ x: z.number(), y: z.number() }).optional()
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
export type FrameSaveInput = z.infer<typeof frameSaveSchema>
export type CustomComponentSaveInput = z.infer<typeof customComponentSaveSchema>
export type TemplateSaveInput = z.infer<typeof templateSaveSchema>
