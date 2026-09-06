
export const OAUTH_CODE_TTL_MS = 10 * 60_000
export const OAUTH_TOKEN_TTL_MS = 30 * 86_400_000

export const MAX_REDIRECT_URIS = 10

// Where the authorization code is sent back to. Getting this wrong is the
// classic OAuth hole: a client that accepts any redirect hands the code to
// whoever asked.
//
// Only https, with an exception for loopback, because a desktop application
// cannot hold a certificate and has nowhere else to listen.
export function isUsableRedirect(value: unknown): value is string {
  if (typeof value !== 'string') return false

  let url: URL
  try {
    url = new URL(value.trim())
  }
  catch {
    return false
  }

  if (url.hash) return false

  const loopback = url.hostname === 'localhost'
    || url.hostname === '127.0.0.1'
    || url.hostname === '[::1]'

  if (url.protocol === 'http:') return loopback
  return url.protocol === 'https:'
}

// Comparison ignores the query, because an application legitimately adds its own
// parameters, but everything that decides *where* the browser goes has to match
// exactly. No wildcards, no prefixes.
export function redirectMatches(registered: string, given: string): boolean {
  let a: URL
  let b: URL
  try {
    a = new URL(registered)
    b = new URL(given)
  }
  catch {
    return false
  }

  return a.protocol === b.protocol
    && a.hostname.toLowerCase() === b.hostname.toLowerCase()
    && a.port === b.port
    && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '')
}

export function pickRedirect(registered: string[], given: unknown): string | null {
  if (given === undefined || given === null || given === '') {
    return registered[0] ?? null
  }
  if (typeof given !== 'string') return null

  return registered.find(uri => redirectMatches(uri, given)) ? given : null
}

export function cleanRedirectUris(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  return [...new Set(
    raw.filter(isUsableRedirect).map(uri => uri.trim()),
  )].slice(0, MAX_REDIRECT_URIS)
}

// The `state` parameter is the application's own CSRF token. It is echoed back
// untouched, so it never gets to be anything but a short opaque string.
export function cleanState(raw: unknown): string {
  return typeof raw === 'string' ? raw.slice(0, 500) : ''
}

export function buildRedirect(uri: string, params: Record<string, string>): string {
  const url = new URL(uri)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  return url.toString()
}
