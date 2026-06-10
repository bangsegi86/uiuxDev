import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { ZodError } from 'zod'
import { registerCollab } from './collab.js'
import { registerRoutes } from './routes/index.js'
import { createStorage } from './storage/index.js'

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
