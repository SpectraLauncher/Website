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

export function resetRateLimits() {
  buckets.clear()
}
