import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CATEGORIES } from '../../shared/utils/catalog-types'

// The map lives in a template, so it is read as source rather than imported. A
// category added to CATEGORIES without a mark falls back to a generic tag and
// nothing else notices — which is exactly what this stops.
const source = readFileSync('app/components/icon/Category.vue', 'utf8')
const registry = source.slice(source.indexOf('const ICONS'), source.indexOf('const icon ='))

const mapped = new Set([...registry.matchAll(/^\s*'([a-z-]+)':/gm)].map(match => match[1]!))

describe('ikony kategorii', () => {
  it('kazda kategoria z rejestru ma swoja ikone', () => {
    const missing = [...new Set(Object.values(CATEGORIES).flat())].filter(id => !mapped.has(id))
    expect(missing).toEqual([])
  })

  it('nie mapuje kategorii, ktorych juz nie ma', () => {
    const known = new Set(Object.values(CATEGORIES).flat())
    expect([...mapped].filter(id => !known.has(id))).toEqual([])
  })
})
