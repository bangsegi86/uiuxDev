import { promises as fs } from 'node:fs'
import path from 'node:path'
import { nanoid } from 'nanoid'

/**
 * On-disk store for uploaded images, independent of the storage driver so it
 * works for both local-file and SQL modes. Files live under UPLOAD_DIR
 * (default: <DATA_DIR>/uploads/<projectId>/<id>.<ext>) and are served back via
 * a public GET route. Storing a short URL keeps board JSON small (vs inlining
 * a base64 data URL).
 */
const uploadRoot = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data'), 'uploads')

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
}
const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime])
)

/** Max decoded upload size (8 MB). */
const MAX_BYTES = 8 * 1024 * 1024

/** Decode a base64 data URL, persist it, and return its public URL. */
export async function saveDataUrl(projectId: string, dataUrl: string): Promise<string> {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl)
  if (!m) throw new Error('invalid data url')
  const mime = m[1]
  const ext = MIME_TO_EXT[mime]
  if (!ext) throw new Error('unsupported image type')
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > MAX_BYTES) throw new Error('image too large')
  const dir = path.join(uploadRoot, projectId)
  await fs.mkdir(dir, { recursive: true })
  const file = `${nanoid(16)}.${ext}`
  await fs.writeFile(path.join(dir, file), buf)
  return `/api/uploads/${projectId}/${file}`
}

/** Read a stored upload, guarding against path traversal. */
export async function readUpload(
  projectId: string,
  file: string
): Promise<{ buf: Buffer; mime: string } | null> {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(file) || !/^[A-Za-z0-9_-]+$/.test(projectId)) return null
  // Defense in depth: ensure the resolved path stays inside the upload root.
  const full = path.resolve(uploadRoot, projectId, file)
  if (full !== path.join(path.resolve(uploadRoot), projectId, file)) return null
  try {
    const buf = await fs.readFile(full)
    const ext = file.split('.').pop()!.toLowerCase()
    return { buf, mime: EXT_TO_MIME[ext] ?? 'application/octet-stream' }
  } catch {
    return null
  }
}
