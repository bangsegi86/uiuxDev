import { useEffect, useRef } from 'react'
import type { NodeInstance } from '@uiux/shared'
import { useEditor } from '../state/editorStore'
import { useAuth } from '../state/authStore'
import { getToken } from '../lib/apiClient'
import { setCursorSender } from '../lib/collabBus'

interface FrameInfo {
  frameId: string
  root: NodeInstance
}

/** Active editable frame (none while the component editor is open). */
function activeFrameInfo(s: ReturnType<typeof useEditor.getState>): FrameInfo | null {
  if (s.componentDraft) return null
  const f = s.doc?.frames.find((fr) => fr.id === s.activeFrameId)
  return f ? { frameId: f.id, root: f.root } : null
}

/**
 * Realtime collaboration: one websocket per open document; screen-tree updates
 * are scoped to a frame id, applied to that frame for every peer. Local cursor
 * positions and presence are also relayed. Echoes are avoided by remembering
 * the last remotely-applied root reference.
 */
export function useCollaboration() {
  const user = useAuth((s) => s.user)
  const docId = useEditor((s) => s.doc?.id ?? null)
  const applyRemoteRoot = useEditor((s) => s.applyRemoteRoot)
  const setCollaborators = useEditor((s) => s.setCollaborators)
  const setRemoteCursor = useEditor((s) => s.setRemoteCursor)
  const pruneCursors = useEditor((s) => s.pruneCursors)

  const wsRef = useRef<WebSocket | null>(null)
  const lastRemoteRoot = useRef<unknown>(null)
  const lastSentRoot = useRef<unknown>(null)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!user || !docId) return
    const token = getToken()
    if (!token) return

    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${location.host}/api/ws?token=${encodeURIComponent(
      token
    )}&screenId=${encodeURIComponent(docId)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setCursorSender((x, y) => ws.send(JSON.stringify({ type: 'cursor', x, y })))

    ws.onmessage = (e) => {
      let msg: {
        type?: string
        users?: { id: string; email: string }[]
        root?: NodeInstance
        frameId?: string
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
      } else if (msg.type === 'update' && msg.root && msg.frameId) {
        lastRemoteRoot.current = msg.root
        applyRemoteRoot(msg.frameId, msg.root)
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
  }, [user, docId, applyRemoteRoot, setCollaborators, setRemoteCursor, pruneCursors])

  // Broadcast local frame edits to peers (debounced), skipping echoes.
  useEffect(() => {
    return useEditor.subscribe((state, prev) => {
      const cur = activeFrameInfo(state)
      const before = activeFrameInfo(prev)
      if (!cur) return
      if (cur.root === before?.root) return
      if (cur.root === lastRemoteRoot.current) return
      if (cur.root === lastSentRoot.current) return
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      lastSentRoot.current = cur.root
      clearTimeout(sendTimer.current)
      sendTimer.current = setTimeout(() => {
        ws.send(JSON.stringify({ type: 'update', frameId: cur.frameId, root: cur.root }))
      }, 150)
    })
  }, [])
}
