
// What a personal access token is allowed to do. A session can do everything
// the account can; a token is for handing a narrow slice to a script or a
// launcher, and the point is that it cannot do the rest.
//
// To add a scope: one entry here, one `tokens.scopes.<key>` string per locale,
// and the requirement at the route that needs it.
export const TOKEN_SCOPES = {
  'user:read': 1 << 0,
  'user:write': 1 << 1,
  'notifications:read': 1 << 2,
  'notifications:write': 1 << 3,
  'projects:read': 1 << 4,
  'projects:write': 1 << 5,
  'projects:create': 1 << 6,
  'versions:read': 1 << 7,
  'versions:write': 1 << 8,
  'collections:read': 1 << 9,
  'collections:write': 1 << 10,
  'analytics:read': 1 << 11,
  'payouts:read': 1 << 12,
} as const

export type TokenScope = keyof typeof TOKEN_SCOPES

export const TOKEN_SCOPE_KEYS = Object.keys(TOKEN_SCOPES) as TokenScope[]

export const ALL_TOKEN_SCOPES = TOKEN_SCOPE_KEYS
  .reduce((mask, key) => mask | TOKEN_SCOPES[key], 0)

// Deliberately never grantable to a token. Changing the password or the e-mail
// address is how an account is taken over, and a leaked token must not be able
// to do it.
export const FORBIDDEN_TO_TOKENS = ['account:security', 'tokens:manage'] as const

export const TOKEN_PREFIX = 'spx_'

// Shown once at creation and never again, so it has to be long enough that the
// stored hash is the only copy worth having.
export const TOKEN_BYTES = 32

export function isTokenScope(value: unknown): value is TokenScope {
  return TOKEN_SCOPE_KEYS.includes(value as TokenScope)
}

export function scopesToMask(list: unknown): number {
  if (!Array.isArray(list)) return 0
  return list.reduce<number>(
    (mask, key) => (isTokenScope(key) ? mask | TOKEN_SCOPES[key] : mask),
    0,
  )
}

export function maskToScopes(mask: number): TokenScope[] {
  return TOKEN_SCOPE_KEYS.filter(key => (mask & TOKEN_SCOPES[key]) !== 0)
}

export function hasScope(mask: number, scope: TokenScope): boolean {
  return (mask & TOKEN_SCOPES[scope]) !== 0
}

// A read scope is implied by its write twin: a token that may change a project
// can obviously see it, and making people tick both is a trap.
export function expandImplied(mask: number): number {
  let out = mask
  for (const key of TOKEN_SCOPE_KEYS) {
    if (!key.endsWith(':write') && !key.endsWith(':create')) continue
    if ((mask & TOKEN_SCOPES[key]) === 0) continue

    const read = `${key.split(':')[0]}:read` as TokenScope
    if (isTokenScope(read)) out |= TOKEN_SCOPES[read]
  }
  return out
}
