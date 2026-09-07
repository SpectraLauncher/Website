import { describe, expect, it } from 'vitest'

import { DETAILS } from '../../server/api/catalog/project/[slug].patch'
import { fullProject } from '../../server/utils/catalog-present'
import type { ProjectRow } from '../../server/utils/catalog'

// A field the author may change has to come back in the response, or the form
// that sent it resets itself on the next load and the save looks like it never
// happened. `environment` was missing for exactly that reason.
const row = {
  id: 'p1',
  slug: 'test',
  type: 'mod',
  title: 'Test',
  summary: 'Podsumowanie',
  description: 'Opis',
  status: 'draft',
  requested_status: 'unlisted',
  license: 'MIT',
  license_url: null,
  icon: null,
  categories: ['technology'],
  featured_categories: ['technology'],
  game_versions: ['1.21'],
  loaders: ['fabric'],
  environment: ['client', 'server'],
  links: { source: 'https://example.com' },
  disclosures: {},
  meta: {},
  price: 0,
  currency: 'EUR',
  downloads: 0,
  follows: 0,
  owner_id: 'u1',
  org_id: null,
  published: null,
  created: 1,
  updated: 2,
} as unknown as ProjectRow

// `visibility` is not a column: it is read back off these two together.
const DERIVED: Record<string, string[]> = {
  visibility: ['status', 'requestedStatus'],
}

describe('prezenter projektu', () => {
  const shown = fullProject(row, [], []) as Record<string, unknown>

  it.each([...DETAILS])('zwraca pole edytowalne %s', (field) => {
    for (const key of DERIVED[field] ?? [field]) {
      expect(shown).toHaveProperty(key)
      expect(shown[key]).toBeDefined()
    }
  })

  it('nie gubi wartosci, ktore forma odsyla', () => {
    expect(shown.environment).toEqual(['client', 'server'])
    expect(shown.featuredCategories).toEqual(['technology'])
    expect(shown.requestedStatus).toBe('unlisted')
  })
})
