import type { H3Event } from 'h3'

interface Bucket {
  hits: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

const MAX_BUCKETS = 50_000

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function clientIp(event: H3Event): string {
  const cf = getHeader(event, 'cf-connecting-ip')
  if (cf) return cf.trim()

  const forwarded = getHeader(event, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()

  return getRequestIP(event, { xForwardedFor: false }) ?? 'unknown'
}

export interface RateLimitResult {
  allowed: boolean
  retryAfter: number
}

export function take(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (buckets.size > MAX_BUCKETS) sweep(now)

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { hits: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  bucket.hits++

  if (bucket.hits > limit) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  return { allowed: true, retryAfter: 0 }
}

export function rateLimit(event: H3Event, options: { key: string, limit: number, windowMs: number }) {
  const { allowed, retryAfter } = take(options.key, options.limit, options.windowMs)
  if (allowed) return

  setResponseHeader(event, 'retry-after', String(Math.max(1, retryAfter)))
  throw createError({ statusCode: 429, statusMessage: 'too many requests' })
}

// Per-IP limits for the endpoints anyone can reach without an account. The
// launcher used to send a shared `x-spectra-key`, but a constant compiled into
// a desktop binary is public by definition, so these limits — not a key — are
// what keeps the anonymous surface usable. Endpoints keyed by user id keep
// their own inline limits instead.
//
// ponytail: in-process buckets, so this resets on deploy and is per-replica.
// Move to Cloudflare rate-limiting rules (or a shared store) before scaling out.

const SENSITIVE_AUTH = [
  '/api/auth/sign-in',
  '/api/auth/sign-up',
  '/api/auth/forget-password',
  '/api/auth/reset-password',
  '/api/auth/two-factor',
  '/api/auth/one-time-token',
]

// GET /api/share/ABC123 — a 6-character code is guessable if you may guess fast.
const SHARE_CODE = /^\/api\/share\/[^/]+$/

// The catalog and the Modrinth-compatible surface are the endpoints a launcher
// hits on every start, so they get their own budgets rather than sharing one.
const CATALOG_LIMITS: Array<[RegExp, string, number]> = [
  [/^\/api\/v2\/version_files$/, 'v2-hash-bulk', 20],
  [/^\/api\/v2\/version_file\//, 'v2-hash', 120],
  [/^\/api\/v2\//, 'v2', 120],
  [/^\/api\/catalog\/download\//, 'catalog-download', 120],
  [/^\/api\/catalog\/search$/, 'catalog-search', 60],
  [/^\/api\/catalog\//, 'catalog', 120],
]

export function limitFor(path: string, method: string): { name: string, limit: number } | null {
  for (const [pattern, name, limit] of CATALOG_LIMITS) {
    if (pattern.test(path)) return { name, limit }
  }

  if (path === '/api/telemetry') return { name: 'telemetry', limit: 30 }
  if (path.startsWith('/api/mc-')) return { name: 'mojang', limit: 60 }
  if (method === 'GET' && SHARE_CODE.test(path)) return { name: 'share-get', limit: 20 }

  if (path.startsWith('/api/auth/')) {
    return SENSITIVE_AUTH.some(p => path.startsWith(p))
      ? { name: 'auth-sensitive', limit: 10 }
      : { name: 'auth', limit: 120 }
  }

  return null
}

export function resetRateLimits() {
  buckets.clear()
}
