import { useEffect, useRef } from 'react'
import type { NodeInstance } from '@uiux/shared'
import { selectActiveScreenId, useEditor } from '../state/editorStore'
import { useAuth } from '../state/authStore'
import { getToken } from '../lib/apiClient'
import { setCursorSender } from '../lib/collabBus'

/**
 * Realtime collaboration: one websocket per open screen. Tree updates carry the
 * screen id and are applied to that screen for every peer. Cursor positions and
 * presence are relayed too. Echoes are avoided by remembering the last
 * remotely-applied root reference.
 */
export function useCollaboration() {
  const user = useAuth((s) => s.user)
  const screenId = useEditor(selectActiveScreenId)
  const applyRemoteRoot = useEditor((s) => s.applyRemoteRoot)
  const setCollaborators = useEditor((s) => s.setCollaborators)
  const setRemoteCursor = useEditor((s) => s.setRemoteCursor)
  const pruneCursors = useEditor((s) => s.pruneCursors)

  const wsRef = useRef<WebSocket | null>(null)
  const lastRemoteRoot = useRef<unknown>(null)
  const lastSentRoot = useRef<unknown>(null)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
        applyRemoteRoot(screenId, msg.root)
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

  // Broadcast local screen edits to peers (debounced), skipping echoes.
  useEffect(() => {
    return useEditor.subscribe((state, prev) => {
      const id = selectActiveScreenId(state)
      if (!id) return
      const cur = state.screens[id]?.root
      const before = prev.screens[id]?.root
      if (!cur || cur === before) return
      if (cur === lastRemoteRoot.current) return
      if (cur === lastSentRoot.current) return
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      lastSentRoot.current = cur
      clearTimeout(sendTimer.current)
      sendTimer.current = setTimeout(() => {
        ws.send(JSON.stringify({ type: 'update', root: cur }))
      }, 150)
    })
  }, [])
}
