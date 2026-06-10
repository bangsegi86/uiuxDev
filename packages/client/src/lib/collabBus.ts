/**
 * Tiny bridge so the Canvas can push the local cursor position to the
 * collaboration websocket owned by `useCollaboration`, without prop drilling.
 */
type CursorSender = (x: number, y: number) => void

let sender: CursorSender | null = null

export function setCursorSender(fn: CursorSender | null) {
  sender = fn
}

export function sendCursor(x: number, y: number) {
  sender?.(x, y)
}
