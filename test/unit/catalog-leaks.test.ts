import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PROJECT_TYPES, TYPE_PREFIX } from '../../server/utils/catalog-types'

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
    // PRIVATE_PATHS zasila robots.disallow i sitemap.exclude — jesli ktos zerwie
    // ktores z tych dwoch powiazan, katalog wycieknie mimo poprawnej listy.
    expect(nuxtConfig).toContain('disallow: [...PRIVATE_PATHS')
    expect(nuxtConfig).toContain('exclude: PRIVATE_PATHS.map')
  })

  // llms.txt i lustra .md, ktore pisze nuxt-ai-ready, obejmuja wylacznie strony
  // prerenderowane. Trasa katalogu w PRERENDER wyladowalaby tam natychmiast, i to
  // niezaleznie od robots.txt.
  it('zadna trasa katalogu nie jest prerenderowana', () => {
    const prerender = nuxtConfig.slice(nuxtConfig.indexOf('const PRERENDER'))
      .slice(0, nuxtConfig.slice(nuxtConfig.indexOf('const PRERENDER')).indexOf(']') + 1)

    for (const path of catalogPaths) {
      expect(prerender, path).not.toContain(path)
    }
  })

  it('sitemap pyta o flage, zanim doda cokolwiek z katalogu', () => {
    expect(sitemap).toContain('catalogIsIndexable()')
    // Zwrot nastepuje przed zapytaniem o projekty, wiec przy wylaczonej fladze
    // zapytanie w ogole nie leci.
    expect(sitemap.indexOf('catalogIsIndexable()')).toBeLessThan(sitemap.indexOf('FROM project'))
  })

  it('sitemap bierze wylacznie projekty opublikowane', () => {
    expect(sitemap).toContain(`status = 'published'`)
  })
})
