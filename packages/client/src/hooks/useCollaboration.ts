import { useEffect, useRef } from 'react'
import type { NodeInstance } from '@uiux/shared'
import { useEditor } from '../state/editorStore'
import { useAuth } from '../state/authStore'
import { getToken } from '../lib/apiClient'
import { setCursorSender } from '../lib/collabBus'

/**
 * Realtime collaboration: open a websocket per open screen, apply remote
 * screen-tree updates, broadcast local edits (debounced), and track presence.
 * Echoes are avoided by remembering the last remotely-applied root reference.
 */
export function useCollaboration() {
  const user = useAuth((s) => s.user)
  const screenId = useEditor((s) => s.screen?.id ?? null)
  const applyRemoteRoot = useEditor((s) => s.applyRemoteRoot)
  const setCollaborators = useEditor((s) => s.setCollaborators)
  const setRemoteCursor = useEditor((s) => s.setRemoteCursor)
  const pruneCursors = useEditor((s) => s.pruneCursors)

  const wsRef = useRef<WebSocket | null>(null)
  const lastRemoteRoot = useRef<unknown>(null)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Connection lifecycle, re-established whenever the open screen changes.
  useEffect(() => {
    if (!user || !screenId) return
    const token = getToken()
    if (!token) return

    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${location.host}/api/ws?token=${encodeURIComponent(
      token
    )}&screenId=${encodeURIComponent(screenId)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    // Let the Canvas push the local cursor through this socket.
    ws.onopen = () => setCursorSender((x, y) => ws.send(JSON.stringify({ type: 'cursor', x, y })))

    ws.onmessage = (e) => {
      let msg: {
        type?: string
        users?: { id: string; email: string }[]
        root?: NodeInstance
        from?: string
        email?: string
        x?: number
        y?: number
      }
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      if (msg.type === 'presence' && msg.users) {
        setCollaborators(msg.users)
        pruneCursors(msg.users.map((u) => u.id))
      } else if (msg.type === 'update' && msg.root) {
        lastRemoteRoot.current = msg.root
        applyRemoteRoot(msg.root)
      } else if (msg.type === 'cursor' && msg.from && typeof msg.x === 'number' && typeof msg.y === 'number') {
        setRemoteCursor(msg.from, { email: msg.email ?? '', x: msg.x, y: msg.y })
      }
    }
    ws.onclose = () => setCollaborators([])

    return () => {
      setCursorSender(null)
      ws.close()
      wsRef.current = null
      setCollaborators([])
    }
  }, [user, screenId, applyRemoteRoot, setCollaborators, setRemoteCursor, pruneCursors])

  // Broadcast local screen-tree changes to peers (debounced), skipping echoes.
  useEffect(() => {
    return useEditor.subscribe((state, prev) => {
      const root = state.screen?.root
      if (!root || root === prev.screen?.root) return
      if (root === lastRemoteRoot.current) return
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      clearTimeout(sendTimer.current)
      sendTimer.current = setTimeout(() => {
        ws.send(JSON.stringify({ type: 'update', root }))
      }, 150)
    })
  }, [])
}
