import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import { routes } from '@uiux/shared'
import { verifyToken } from './auth.js'
import { userOwnsScreen } from './access.js'
import type { StorageAdapter } from './storage/index.js'

/**
 * Realtime collaboration: clients editing the same screen join a room keyed by
 * screenId. Screen-tree updates are broadcast to the other members (last write
 * wins); presence is broadcast on join/leave. Pragmatic, not a CRDT.
 */

/** Reject collaboration messages larger than this (DoS guard). */
const MAX_WS_MESSAGE = 4 * 1024 * 1024

interface Member {
  socket: WebSocket
  userId: string
  email: string
}

const rooms = new Map<string, Set<Member>>()

function broadcastPresence(screenId: string) {
  const room = rooms.get(screenId)
  if (!room) return
  const users = [...room].map((m) => ({ id: m.userId, email: m.email }))
  const msg = JSON.stringify({ type: 'presence', users })
  for (const m of room) safeSend(m.socket, msg)
}

function safeSend(socket: WebSocket, data: string) {
  try {
    if (socket.readyState === socket.OPEN) socket.send(data)
  } catch {
    // ignore broken pipe
  }
}

export async function registerCollab(app: FastifyInstance, storage: StorageAdapter) {
  app.get(routes.ws, { websocket: true }, async (socket: WebSocket, req) => {
    const query = req.query as { token?: string; screenId?: string }
    const payload = query.token ? verifyToken(query.token) : null
    const screenId = query.screenId

    if (!payload || !screenId) {
      safeSend(socket, JSON.stringify({ type: 'error', error: 'unauthorized' }))
      socket.close()
      return
    }

    // Only let the user join rooms for screens in a project they own (IDOR).
    if (!(await userOwnsScreen(storage, payload.sub, screenId))) {
      safeSend(socket, JSON.stringify({ type: 'error', error: 'forbidden' }))
      socket.close()
      return
    }

    const member: Member = { socket, userId: payload.sub, email: payload.email }
    let room = rooms.get(screenId)
    if (!room) {
      room = new Set()
      rooms.set(screenId, room)
    }
    room.add(member)
    broadcastPresence(screenId)

    socket.on('message', (raw: Buffer) => {
      if (raw.length > MAX_WS_MESSAGE) {
        socket.close(1009, 'message too large')
        return
      }
      let parsed: { type?: string; root?: unknown; x?: number; y?: number }
      try {
        parsed = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (parsed.type === 'update' && parsed.root !== undefined) {
        const out = JSON.stringify({ type: 'update', root: parsed.root, from: member.userId })
        for (const m of room!) if (m !== member) safeSend(m.socket, out)
      } else if (parsed.type === 'cursor' && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        const out = JSON.stringify({
          type: 'cursor',
          from: member.userId,
          email: member.email,
          x: parsed.x,
          y: parsed.y
        })
        for (const m of room!) if (m !== member) safeSend(m.socket, out)
      }
    })

    socket.on('close', () => {
      room!.delete(member)
      if (room!.size === 0) rooms.delete(screenId)
      else broadcastPresence(screenId)
    })
  })
}
