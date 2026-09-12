import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { DEFAULT_SLA_MS, SLA_MS, slaFor, slaState } from '../../shared/utils/reports'
import { REQUIRED, checklistState } from '../../shared/utils/project-checklist'

const read = (file: string) => readFileSync(file, 'utf8')

const HOUR = 60 * 60 * 1000

describe('termin na zgloszenie', () => {
  it('doba na zlosliwy plik, trzy na reszte', () => {
    expect(slaFor('malicious')).toBe(24 * HOUR)
    expect(SLA_MS.malicious).toBe(24 * HOUR)

    for (const reason of ['spam', 'copyright', 'inappropriate', 'name_squatting', 'other']) {
      expect(slaFor(reason), reason).toBe(DEFAULT_SLA_MS)
    }
  })

  it('nieznany powod dostaje termin domyslny, nie zaden', () => {
    expect(slaFor('wymyslony')).toBe(DEFAULT_SLA_MS)
  })

  it('swieze zgloszenie nie jest ani spoznione, ani pilne', () => {
    const now = Date.now()
    const state = slaState('spam', now, now)

    expect(state.late).toBe(false)
    expect(state.soon).toBe(false)
    expect(state.remaining).toBe(DEFAULT_SLA_MS)
  })

  it('po terminie jest spoznione, a tuz przed — pilne', () => {
    const now = Date.now()

    expect(slaState('malicious', now - 25 * HOUR, now).late).toBe(true)
    expect(slaState('malicious', now - 25 * HOUR, now).remaining).toBeLessThan(0)

    // ostatnia czwarta czesc okna
    const soon = slaState('malicious', now - 20 * HOUR, now)
    expect(soon.late).toBe(false)
    expect(soon.soon).toBe(true)

    expect(slaState('malicious', now - 2 * HOUR, now).soon).toBe(false)
  })

  it('zlosliwy plik jest pilny wczesniej niz spam zlozony w tej samej chwili', () => {
    const now = Date.now()
    const filed = now - 20 * HOUR

    expect(slaState('malicious', filed, now).soon).toBe(true)
    expect(slaState('spam', filed, now).soon).toBe(false)
  })
})

describe('kolejka recenzji', () => {
  it('chipy licza te same braki, co checklist autora', () => {
    const empty = checklistState({})
    expect(REQUIRED.filter(item => !empty[item]).sort())
      .toEqual(['categories', 'description', 'license', 'summary', 'version'])

    const done = checklistState({
      summary: 'wystarczajaco dlugie streszczenie',
      description: 'x'.repeat(100),
      categories: ['worldgen'],
      license: 'MIT',
      versions: [{}],
      disclosures: {},
    })
    expect(REQUIRED.filter(item => !done[item])).toEqual([])
  })

  it('kolejka liczy wersje i oflagowane pliki jednym zapytaniem na strone', () => {
    const source = read('server/api/admin/catalog/queue.get.ts')

    expect(source).toMatch(/versionCounts\(ids\)/)
    expect(source).toMatch(/flaggedCounts\(ids\)/)
    expect(source).toMatch(/reviewersOf\(ids\)/)
    // nie w petli po wierszach
    expect(source).not.toMatch(/hits\.map\([^)]*versionCounts/)
  })

  it('przypisanie recenzji nie jest blokada', () => {
    const source = read('server/api/admin/catalog/projects/[id]/claim.post.ts')

    expect(source).toMatch(/requireModeration\(event\)/)
    // zdjecie przypisania jest mozliwe, inaczej kolejka staje
    expect(source).toMatch(/claim !== false/)
    expect(source).toMatch(/reviewer_id = \$2/)
  })
})
