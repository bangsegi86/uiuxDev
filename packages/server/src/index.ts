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

const isProd = process.env.NODE_ENV === 'production'

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

/** Allowed CORS origins: any in dev; an explicit allow-list in production. */
function corsOrigin(): boolean | string[] {
  const list = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (isProd) {
    if (!list.length) throw new Error('ALLOWED_ORIGINS must be set in production')
    return list
  }
  return list.length ? list : true
}

/**
 * Tiny in-memory fixed-window rate limiter (no external dependency). Keyed by
 * client ip; used to throttle auth endpoints against brute force.
 */
function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return (key: string): boolean => {
    const now = Date.now()
    const cur = hits.get(key)
    if (!cur || now > cur.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }
    if (cur.count >= max) return false
    cur.count++
    return true
  }
}

async function main() {
  const app = Fastify({ logger: true, bodyLimit: 1 * 1024 * 1024 })
  await app.register(cors, { origin: corsOrigin() })
  await app.register(websocket)

  // Baseline security headers (no helmet dependency).
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'SAMEORIGIN')
    reply.header('Referrer-Policy', 'no-referrer')
    if (isProd) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  })

  // Throttle auth endpoints (5 attempts / 15 min / ip).
  const authLimiter = createRateLimiter(5, 15 * 60 * 1000)
  app.addHook('preHandler', async (req, reply) => {
    if (req.method === 'POST' && (req.url === '/api/auth/login' || req.url === '/api/auth/register')) {
      if (!authLimiter(req.ip)) {
        return reply.code(429).send({ error: 'too many attempts, please try again later' })
      }
    }
  })

  // Validation errors → 400; everything else → safe message (no internal leak).
  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'validation', issues: err.issues })
    }
    const status = err.statusCode ?? 500
    if (status >= 500) app.log.error(err)
    return reply.code(status).send({ error: status >= 500 ? 'internal server error' : err.message })
  })

  const storage = await createStorage()
  const seeded = await seedAdmin(storage)
  if (seeded) {
    // Never print the password in production logs.
    if (isProd) {
      app.log.warn(`Seeded admin account ${seeded.email}. Set ADMIN_PASSWORD env and rotate it now.`)
    } else {
      app.log.info(`Seeded admin account → email: ${seeded.email}  password: ${seeded.password}`)
    }
  }
  await registerRoutes(app, storage)
  await registerCollab(app, storage)

  const port = Number(process.env.PORT ?? 4000)
  const host = process.env.HOST ?? '0.0.0.0'
  await app.listen({ port, host })
  app.log.info(`UI/UX builder API ready on http://${host}:${port} (storage=${storage.name})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
