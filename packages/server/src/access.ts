import type { StorageAdapter } from './storage/index.js'

/**
 * Resource-scoping helpers. The route guard already proves the caller owns the
 * project named in the URL; these confirm the addressed screen/board actually
 * belongs to *that* project so a user cannot read or modify another user's
 * resource by guessing its id (IDOR).
 */

export async function screenInProject(
  storage: StorageAdapter,
  projectId: string,
  screenId: string
): Promise<boolean> {
  const tree = await storage.listTree(projectId)
  return tree.some((n) => n.type === 'screen' && n.screenId === screenId)
}

export async function boardInProject(
  storage: StorageAdapter,
  projectId: string,
  boardId: string
): Promise<boolean> {
  const tree = await storage.listTree(projectId)
  return tree.some((n) => n.type === 'board' && n.boardId === boardId)
}

/** True if the user owns a project whose tree references the given screen. */
export async function userOwnsScreen(
  storage: StorageAdapter,
  userId: string,
  screenId: string
): Promise<boolean> {
  for (const p of await storage.listProjects()) {
    if (p.ownerId && p.ownerId !== userId) continue
    if (await screenInProject(storage, p.id, screenId)) return true
  }
  return false
}
