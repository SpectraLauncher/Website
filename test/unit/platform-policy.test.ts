import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { DEFAULT_POLICY, POLICY_KEYS, sanitizePolicy } from '../../shared/utils/platform-policy'

const read = (file: string) => readFileSync(file, 'utf8')

describe('polityka platformy', () => {
  it('domyslnie strona dziala, a skan jest wymagany', () => {
    expect(DEFAULT_POLICY).toEqual({ maintenance: false, submissions: true, scanGate: true })
  })

  it('smiec na wejsciu nie zmienia niczego', () => {
    for (const raw of [null, undefined, 42, 'yes', [], { nonsense: true }]) {
      expect(sanitizePolicy(raw), String(raw)).toEqual(DEFAULT_POLICY)
    }
  })

  // A string is the dangerous case: "false" is truthy, so a knob set from a
  // form that forgot to parse would read as on.
  it('tylko prawdziwy boolean przechodzi', () => {
    expect(sanitizePolicy({ maintenance: 'true' }).maintenance).toBe(false)
    expect(sanitizePolicy({ maintenance: 'false' }).maintenance).toBe(false)
    expect(sanitizePolicy({ scanGate: 0 }).scanGate).toBe(true)
    expect(sanitizePolicy({ scanGate: false }).scanGate).toBe(false)
    expect(sanitizePolicy({ maintenance: true }).maintenance).toBe(true)
  })

  it('kazdy klucz jest wymieniony', () => {
    expect([...POLICY_KEYS].sort()).toEqual(['maintenance', 'scanGate', 'submissions'])
  })
})

describe('co robia przelaczniki', () => {
  it('tryb konserwacji blokuje zapisy, ale nie logowanie i nie panel', () => {
    const source = read('server/middleware/maintenance.ts')

    expect(source).toMatch(/'\/api\/auth\/', '\/api\/admin\/'/)
    expect(source).toMatch(/SAFE_METHODS.has\(event\.method\)/)
    expect(source).toMatch(/statusCode: 503/)
  })

  it('zamkniete zgloszenia zatrzymuja wysylke do recenzji', () => {
    expect(read('server/api/catalog/project/[slug]/submit.post.ts'))
      .toMatch(/platformPolicy\(\)\)\.submissions/)
  })

  it('brama skanu da sie wylaczyc, ale wymuszenie nadal jest swiadome', () => {
    const source = read('server/api/admin/catalog/projects/[id]/moderate.post.ts')
    expect(source).toMatch(/body\.force !== true && \(await platformPolicy\(\)\)\.scanGate/)
  })

  it('polityke zmienia wylacznie wlasciciel i zostaje slad', () => {
    const source = read('server/api/admin/platform.patch.ts')
    expect(source).toMatch(/requireOwner\(event\)/)
    expect(source).toMatch(/recordStaffAction/)
  })

  // The build-time flag is deliberately not something the panel can move.
  it('flaga katalogu nie jest zapisywalna z panelu', () => {
    expect(read('server/api/admin/platform.patch.ts')).not.toMatch(/catalogPublic/)
    expect(POLICY_KEYS).not.toContain('catalogPublic' as never)
  })
})
