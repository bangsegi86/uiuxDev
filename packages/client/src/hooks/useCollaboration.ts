import { useEffect, useRef } from 'react'
import type { NodeInstance } from '@uiux/shared'
import { useEditor } from '../state/editorStore'
import { useAuth } from '../state/authStore'
import { getToken } from '../lib/apiClient'

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

    ws.onmessage = (e) => {
      let msg: { type?: string; users?: { id: string; email: string }[]; root?: NodeInstance }
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      if (msg.type === 'presence' && msg.users) {
        setCollaborators(msg.users)
      } else if (msg.type === 'update' && msg.root) {
        lastRemoteRoot.current = msg.root
        applyRemoteRoot(msg.root)
      }
    }
    ws.onclose = () => setCollaborators([])

    return () => {
      ws.close()
      wsRef.current = null
      setCollaborators([])
    }
  }, [user, screenId, applyRemoteRoot, setCollaborators])

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
