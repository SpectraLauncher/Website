import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { API_ENDPOINTS, isCatalogEndpoint } from '../../shared/utils/api-reference'
import {
  CATALOG_DOC_PAGES,
  DOC_PAGES,
  DOC_SECTIONS,
  docPages,
  docSections,
  neighbours,
} from '../../shared/utils/docs'

const read = (path: string) => readFileSync(path, 'utf8')

describe('dokumentacja katalogu przy zamknietej fladze', () => {
  it('kazda strona katalogu istnieje w podreczniku', () => {
    for (const page of CATALOG_DOC_PAGES) expect(DOC_PAGES, page).toContain(page)
  })

  it('zamkniety katalog nie pokazuje zadnej jego strony', () => {
    for (const page of CATALOG_DOC_PAGES) expect(docPages(false), page).not.toContain(page)
  })

  it('zostaja strony, ktore nie mowia o katalogu', () => {
    expect(docPages(false)).toEqual(expect.arrayContaining(['account', 'launcher', 'api-tokens', 'oauth']))
  })

  it('zadna sekcja nie zostaje pusta', () => {
    for (const section of docSections(false)) expect(section.pages.length, section.id).toBeGreaterThan(0)
  })

  it('otwarty katalog pokazuje caly podrecznik', () => {
    expect(docPages(true)).toEqual(DOC_PAGES)
  })

  it('poprzednia i nastepna strona omijaja ukryte', () => {
    const pages = docPages(false)
    for (const page of pages) {
      const { previous, next } = neighbours(page, pages)
      if (previous) expect(CATALOG_DOC_PAGES, page).not.toContain(previous)
      if (next) expect(CATALOG_DOC_PAGES, page).not.toContain(next)
    }
  })

  it('prerender bierze strony przez flage', () => {
    expect(read('nuxt.config.ts')).toContain('docPages(CATALOG_PUBLIC)')
  })

  it.each([
    'app/pages/docs/index.vue',
    'app/pages/docs/[slug].vue',
  ])('%s czyta strony przez flage', (file) => {
    const source = read(file)
    expect(source).toContain('useCatalogOpen()')
    expect(source).not.toContain('DOC_SECTIONS')
  })
})

describe('referencja API przy zamknietej fladze', () => {
  it('grupy katalogu znikaja w calosci', () => {
    for (const { route, group } of API_ENDPOINTS) {
      if (['catalog', 'projects', 'collections'].includes(group)) {
        expect(isCatalogEndpoint(route), route).toBe(true)
      }
    }
  })

  it('konto i znajomi zostaja w referencji', () => {
    expect(isCatalogEndpoint('GET /api/friends')).toBe(false)
    expect(isCatalogEndpoint('GET /api/me/tokens')).toBe(false)
    expect(isCatalogEndpoint('GET /api/catalog/search')).toBe(true)
  })

  it('strona referencji filtruje przez flage', () => {
    const source = read('app/pages/docs/api.vue')
    expect(source).toContain('useCatalogOpen()')
    expect(source).toContain('isCatalogEndpoint')
  })
})

describe('tresc dokumentacji katalogu nie trafia do paczki JS', () => {
  const locales = ['en', 'pl']

  it('zadna strona katalogu nie lezy w app/content, z ktorego Vite pakuje wszystko', () => {
    for (const locale of locales) {
      const bundled = readdirSync(`app/content/docs/${locale}`).map(file => file.replace(/\.md$/, ''))
      for (const page of CATALOG_DOC_PAGES) expect(bundled, `${locale}/${page}`).not.toContain(page)
    }
  })

  it('kazda strona katalogu ma tresc po angielsku i po polsku na serwerze', () => {
    for (const locale of locales) {
      const served = readdirSync(`server/assets/manual/${locale}`).map(file => file.replace(/\.md$/, ''))
      for (const page of CATALOG_DOC_PAGES) expect(served, `${locale}/${page}`).toContain(page)
    }
  })

  it('dokumentacja addonow to osobna sekcja, cala schowana przy zamknietym katalogu', () => {
    const addons = DOC_SECTIONS.find(section => section.id === 'addons')
    expect(addons?.pages.length).toBeGreaterThanOrEqual(6)
    for (const page of addons!.pages) expect(CATALOG_DOC_PAGES, page).toContain(page)
    expect(docSections(false).map(section => section.id)).not.toContain('addons')
  })

  it('szablony w dokumentacji to te, ktore serwer umie oddac', () => {
    for (const locale of locales) {
      const page = read(`server/assets/manual/${locale}/addon-templates.md`)
      for (const name of ['theme', 'page', 'window', 'backend']) {
        expect(page, locale).toContain(`/api/catalog/addon-templates/${name}`)
      }
    }
  })

  it('serwer oddaje ja tylko przez straznika katalogu i tylko z listy', () => {
    const route = read('server/api/catalog/docs/[slug].get.ts')
    expect(route.indexOf('requireCatalogRead(event)')).toBeLessThan(route.indexOf('useStorage('))
    expect(route).toContain('CATALOG_DOC_PAGES.includes(slug)')
  })

  it('strona dokumentacji bierze strony katalogu z serwera', () => {
    const page = read('app/pages/docs/[slug].vue')
    expect(page).toContain('/api/catalog/docs/')
    expect(page).toContain('fromServer.value ? (remote.value?.markdown ?? null) : docContent(slug.value)')
  })
})
