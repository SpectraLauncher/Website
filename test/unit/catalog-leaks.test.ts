import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  LINKABLE_STATUSES,
  LISTED_STATUSES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  TYPE_PREFIX,
  isLinkable,
  isListed,
} from '../../server/utils/catalog-types'

const nuxtConfig = readFileSync('nuxt.config.ts', 'utf8')
const sitemap = readFileSync('server/api/__sitemap__/urls.ts', 'utf8')

function arrayLiteral(source: string, name: string): string[] {
  const match = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\]`).exec(source)
  if (!match) throw new Error(`nie znalazlem ${name} w nuxt.config.ts`)
  return [...match[1]!.matchAll(/'([^']+)'/g)].map(m => m[1]!)
}

describe('katalog nie wycieka, dopoki flaga jest wylaczona', () => {
  const catalogPaths = arrayLiteral(nuxtConfig, 'CATALOG_PATHS')

  it('kazdy prefiks typu projektu jest w CATALOG_PATHS', () => {
    for (const type of PROJECT_TYPES) {
      expect(catalogPaths, type).toContain(`/${TYPE_PREFIX[type]}`)
    }
  })

  it('organizacje tez, bo istnieja wylacznie po to, zeby posiadac projekty', () => {
    expect(catalogPaths).toContain('/org')
  })

  it('CATALOG_PATHS dolaczaja do PRIVATE_PATHS, gdy flaga jest wylaczona', () => {
    expect(nuxtConfig).toContain('...(CATALOG_PUBLIC ? [] : CATALOG_PATHS)')
    // PRIVATE_PATHS feeds robots.disallow and sitemap.exclude. Break either
    // link and the catalog leaks despite a correct list.
    expect(nuxtConfig).toContain('disallow: [...PRIVATE_PATHS')
    expect(nuxtConfig).toContain('exclude: PRIVATE_PATHS.map')
  })

  // llms.txt and the markdown mirrors cover prerendered pages only. A catalog
  // route in PRERENDER lands there at once, whatever robots.txt says.
  it('zadna trasa katalogu nie jest prerenderowana', () => {
    const prerender = nuxtConfig.slice(nuxtConfig.indexOf('const PRERENDER'))
      .slice(0, nuxtConfig.slice(nuxtConfig.indexOf('const PRERENDER')).indexOf(']') + 1)

    for (const path of catalogPaths) {
      expect(prerender, path).not.toContain(path)
    }
  })

  it('sitemap pyta o flage, zanim doda cokolwiek z katalogu', () => {
    expect(sitemap).toContain('catalogIsIndexable()')
    // The return happens before the projects query, so with the flag off the
    // query never runs.
    expect(sitemap.indexOf('catalogIsIndexable()')).toBeLessThan(sitemap.indexOf('FROM project'))
  })

  it('sitemap bierze statusy z listy widocznych, a nie dowolne', () => {
    expect(sitemap).toContain('LISTED_STATUSES')
  })
})

// Two different questions. Conflating them is how a project marked as
// link-only ends up in the sitemap.
describe('statusy: widoczny z linku to nie to samo co widoczny na liscie', () => {
  it('unlisted otwiera sie z linku, ale nigdzie sie nie pokazuje', () => {
    expect(isLinkable('unlisted')).toBe(true)
    expect(isListed('unlisted')).toBe(false)
  })

  it('szkic, odrzucony i usuniety nie otwieraja sie wcale', () => {
    for (const status of ['draft', 'rejected', 'removed']) {
      expect(isLinkable(status), status).toBe(false)
      expect(isListed(status), status).toBe(false)
    }
  })

  it('opublikowany i zarchiwizowany sa i widoczne, i listowane', () => {
    for (const status of ['published', 'archived']) {
      expect(isLinkable(status), status).toBe(true)
      expect(isListed(status), status).toBe(true)
    }
  })

  it('kazdy status listowany jest tez otwieralny z linku', () => {
    for (const status of LISTED_STATUSES) expect(LINKABLE_STATUSES).toContain(status)
  })

  it('nieznany status nie przechodzi przez zadna z bram', () => {
    for (const status of ['', 'approved', 'public', 'anything']) {
      expect(isLinkable(status), status).toBe(false)
      expect(isListed(status), status).toBe(false)
    }
  })

  it('kazdy zadeklarowany status jest rozstrzygniety w obie strony', () => {
    for (const status of PROJECT_STATUSES) {
      expect(typeof isListed(status), status).toBe('boolean')
      expect(typeof isLinkable(status), status).toBe('boolean')
    }
  })
})

// One person's own pages are not part of the catalog and do not open with it.
// /settings used to sit in CATALOG_PATHS, so lifting the flag would have let it
// into the sitemap.
describe('strony konta sa prywatne niezaleznie od flagi', () => {
  const accountPaths = arrayLiteral(nuxtConfig, 'ACCOUNT_PATHS')

  it.each(['/settings', '/notifications', '/library', '/projects', '/organizations',
    '/analytics', '/revenue', '/collections', '/account'])('%s jest w ACCOUNT_PATHS', (path) => {
    expect(accountPaths).toContain(path)
  })

  it('ACCOUNT_PATHS wchodza do PRIVATE_PATHS bezwarunkowo', () => {
    expect(nuxtConfig).toContain('...ACCOUNT_PATHS,')
  })

  it('zadna sciezka konta nie zalezy od CATALOG_PUBLIC', () => {
    const catalogPaths = arrayLiteral(nuxtConfig, 'CATALOG_PATHS')
    for (const path of accountPaths) expect(catalogPaths, path).not.toContain(path)
  })
})
