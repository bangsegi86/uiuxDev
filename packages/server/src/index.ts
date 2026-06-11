import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { nanoid } from 'nanoid'
import { ZodError } from 'zod'
import { hashPassword } from './auth.js'
import { registerCollab } from './collab.js'
import { registerRoutes } from './routes/index.js'
import { createStorage } from './storage/index.js'
import type { StorageAdapter } from './storage/index.js'

/**
 * Ensure a ready-to-use admin account exists so there's always a login without
 * having to register. Credentials come from ADMIN_EMAIL/ADMIN_PASSWORD env vars
 * (defaults: admin@admin.com / admin1234). No-op if the account already exists.
 */
async function seedAdmin(storage: StorageAdapter): Promise<{ email: string; password: string } | null> {
  const email = process.env.ADMIN_EMAIL ?? 'admin@admin.com'
  const password = process.env.ADMIN_PASSWORD ?? 'admin1234'
  if (await storage.getUserByEmail(email)) return null
  await storage.createUser({
    id: nanoid(12),
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  })
  return { email, password }
}

async function main() {
  const app = Fastify({ logger: true })
  await app.register(cors, { origin: true })
  await app.register(websocket)

  // Surface validation errors as 400s.
  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'validation', issues: err.issues })
    }
    app.log.error(err)
    return reply.code(err.statusCode ?? 500).send({ error: err.message })
  })

  const storage = await createStorage()
  const seeded = await seedAdmin(storage)
  if (seeded) {
    app.log.info(`Seeded admin account → email: ${seeded.email}  password: ${seeded.password}`)
  }
  await registerRoutes(app, storage)
  await registerCollab(app)

  const port = Number(process.env.PORT ?? 4000)
  const host = process.env.HOST ?? '0.0.0.0'
  await app.listen({ port, host })
  app.log.info(`UI/UX builder API ready on http://${host}:${port} (storage=${storage.name})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
