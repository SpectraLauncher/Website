import { readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  RESERVED_SLUGS,
  SLUG_MAX,
  isUsableSlug,
  normalizeSlug,
  slugProblem,
} from '../../shared/utils/catalog-slug'
import { PROJECT_TYPES, TYPE_PREFIX } from '../../shared/utils/catalog-types'

describe('normalizeSlug', () => {
  it('sprowadza tytul do sluga', () => {
    expect(normalizeSlug('Sodium Extra')).toBe('sodium-extra')
    expect(normalizeSlug('  Iris   Shaders  ')).toBe('iris-shaders')
    expect(normalizeSlug('C:\\bad/name?')).toBe('c-bad-name')
  })

  it('zdejmuje diakrytyki zamiast je gubic', () => {
    expect(normalizeSlug('Zamek Królewski')).toBe('zamek-krolewski')
    expect(normalizeSlug('Ćwierćnuta')).toBe('cwiercnuta')
  })

  it('nie zostawia myslnikow na brzegach ani serii w srodku', () => {
    expect(normalizeSlug('--a---b--')).toBe('a-b')
    expect(normalizeSlug('!!!')).toBe('')
  })

  it('przycina do SLUG_MAX', () => {
    expect(normalizeSlug('a'.repeat(200))).toHaveLength(SLUG_MAX)
  })
})

describe('slugProblem', () => {
  it('przepuszcza normalny slug', () => {
    expect(slugProblem('create-fabric')).toBeNull()
    expect(isUsableSlug('create-fabric')).toBe(true)
  })

  it('odrzuca za krotkie, za dlugie i czysto numeryczne', () => {
    expect(slugProblem('ab')).toBe('too-short')
    expect(slugProblem('a'.repeat(SLUG_MAX + 1))).toBe('too-long')
    expect(slugProblem('12345')).toBe('numeric')
  })

  it('odrzuca slugi kolidujace z trasami', () => {
    for (const taken of ['tools', 'launcher', 'admin', 'api', 'org', 'settings']) {
      expect(slugProblem(taken), taken).toBe('reserved')
    }
  })

  // /u and /s already fail on length, but they are on the blacklist in case
  // SLUG_MIN ever drops.
  it('odrzuca jednoliterowe trasy', () => {
    expect(isUsableSlug('u')).toBe(false)
    expect(isUsableSlug('s')).toBe(false)
  })
})

describe('blacklista nadaza za trasami', () => {
  // The real failure mode is not "someone typed a bad slug" but "a top-level page
  // was added and nobody put it on the blacklist". This test reads app/pages and
  // will not let such a page through.
  it('kazda strona najwyzszego poziomu jest zarezerwowana', () => {
    const segments = readdirSync('app/pages', { withFileTypes: true })
      .map(e => (e.isDirectory() ? e.name : e.name.replace(/\.vue$/, '')))
      .filter(name => name !== 'index')

    expect(segments.length).toBeGreaterThan(5)
    for (const segment of segments) {
      expect(RESERVED_SLUGS.has(segment), `trasa /${segment} nie jest na blackliscie slugow`).toBe(true)
    }
  })

  it('kazdy prefiks typu projektu jest zarezerwowany', () => {
    for (const type of PROJECT_TYPES) {
      expect(RESERVED_SLUGS.has(TYPE_PREFIX[type]), TYPE_PREFIX[type]).toBe(true)
    }
  })
})
