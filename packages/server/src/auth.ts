import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Minimal auth primitives implemented with node:crypto (no external deps):
 * scrypt password hashing and HS256-style HMAC JWTs.
 */

/**
 * Resolve the token-signing secret. In production AUTH_SECRET is mandatory so a
 * deployment can never silently ship with a publicly-known signing key (which
 * would let anyone forge tokens). In development a fixed fallback is used.
 */
function resolveSecret(): string {
  const fromEnv = process.env.AUTH_SECRET
  if (fromEnv && fromEnv.length >= 16) return fromEnv
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET environment variable (>=16 chars) is required in production')
  }
  if (fromEnv) return fromEnv
  return 'dev-insecure-secret-change-me'
}

const SECRET = resolveSecret()
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const original = Buffer.from(hash, 'hex')
  return candidate.length === original.length && timingSafeEqual(candidate, original)
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export interface TokenPayload {
  sub: string // user id
  email: string
  exp: number
}

export function signToken(user: { id: string; email: string }): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  }
  const body = b64url(JSON.stringify(payload))
  const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const expected = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/** Extract and verify a Bearer token from an Authorization header value. */
export function userFromAuthHeader(header?: string): TokenPayload | null {
  if (!header) return null
  const m = /^Bearer\s+(.+)$/i.exec(header)
  if (!m) return null
  return verifyToken(m[1])
}
