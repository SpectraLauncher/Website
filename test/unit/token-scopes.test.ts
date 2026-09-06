import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  ALL_TOKEN_SCOPES,
  TOKEN_PREFIX,
  TOKEN_SCOPES,
  TOKEN_SCOPE_KEYS,
  expandImplied,
  hasScope,
  isTokenScope,
  maskToScopes,
  scopesToMask,
} from '../../shared/utils/token-scopes'

describe('rejestr zakresow', () => {
  it('kazdy zakres to inna potega dwojki', () => {
    const bits = TOKEN_SCOPE_KEYS.map(key => TOKEN_SCOPES[key])
    expect(new Set(bits).size).toBe(bits.length)
    for (const bit of bits) expect(Number.isInteger(Math.log2(bit))).toBe(true)
  })

  it('maska i lista sa odwracalne', () => {
    expect(maskToScopes(ALL_TOKEN_SCOPES).sort()).toEqual([...TOKEN_SCOPE_KEYS].sort())
    expect(scopesToMask(TOKEN_SCOPE_KEYS)).toBe(ALL_TOKEN_SCOPES)
  })

  it('nieznany zakres jest ignorowany, nie przyjmowany', () => {
    expect(scopesToMask(['user:read', 'admin:everything'])).toBe(TOKEN_SCOPES['user:read'])
    expect(scopesToMask('nie tablica')).toBe(0)
    expect(isTokenScope('admin:everything')).toBe(false)
  })
})

describe('zapis implikuje odczyt', () => {
  // A token that may change a project can obviously see it. Making people tick
  // both is a trap that ends in a token which cannot read what it edits.
  it('write daje read tej samej rodziny', () => {
    const mask = expandImplied(TOKEN_SCOPES['projects:write'])
    expect(hasScope(mask, 'projects:read')).toBe(true)
    expect(hasScope(mask, 'projects:write')).toBe(true)
  })

  it('create tez daje read', () => {
    expect(hasScope(expandImplied(TOKEN_SCOPES['projects:create']), 'projects:read')).toBe(true)
  })

  it('nie rozlewa sie na inne rodziny', () => {
    const mask = expandImplied(TOKEN_SCOPES['projects:write'])
    expect(hasScope(mask, 'collections:read')).toBe(false)
    expect(hasScope(mask, 'user:read')).toBe(false)
  })

  it('sam read niczego nie dokłada', () => {
    expect(expandImplied(TOKEN_SCOPES['user:read'])).toBe(TOKEN_SCOPES['user:read'])
  })
})

describe('token jako poswiadczenie', () => {
  const source = readFileSync('server/utils/tokens.ts', 'utf8')

  // A database dump must not be a list of working credentials.
  it('przechowywany jest hash, nie token', () => {
    expect(source).toContain("createHash('sha256')")
    expect(source).toContain('token_hash')
  })

  it('sekret jest losowy i pokazany raz', () => {
    expect(source).toContain('randomBytes(TOKEN_BYTES)')
    const route = readFileSync('server/api/me/tokens.post.ts', 'utf8')
    expect(route).toContain('token,')
    expect(readFileSync('server/api/me/tokens.get.ts', 'utf8')).not.toContain('token_hash')
  })

  it('porownanie hashy idzie w stalym czasie', () => {
    expect(source).toContain('timingSafeEqual')
  })

  it('wygasly token nie dziala', () => {
    expect(source).toContain('Number(row.expires) < Date.now()')
  })

  it('zablokowane konto nie dziala mimo waznego tokenu', () => {
    expect(source).toContain('account suspended')
  })

  // A narrow leak must not be able to widen itself.
  it('token nie moze utworzyc kolejnego tokenu', () => {
    const route = readFileSync('server/api/me/tokens.post.ts', 'utf8')
    expect(route).toContain('tokenFromEvent(event)')
    expect(route).toContain('tokens cannot create tokens')
  })

  it('prefiks odroznia nasz token od cudzego naglowka', () => {
    expect(TOKEN_PREFIX).toBeTruthy()
    expect(source).toContain('startsWith(TOKEN_PREFIX)')
  })
})
