import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PROJECT_STATUSES } from '../../shared/utils/catalog-types'
import { NOTIFICATION_ICONS } from '../../app/composables/useNotifications'
import { LINK_KINDS } from '../../shared/utils/links'
import { LEGAL_DOCUMENTS } from '../../shared/utils/legal'

const LOCALES = ['en', 'pl'] as const
const load = (loc: string) =>
  JSON.parse(readFileSync(`i18n/locales/${loc}.json`, 'utf8')) as Record<string, any>

// Registries grow in code while translations lag behind, and then the interface
// shows a bare key. Every registry we render in a loop is listed here.
describe.each(LOCALES)('%s', (loc) => {
  const dict = load(loc)

  it('ma nazwe kazdego rodzaju linku', () => {
    for (const kind of LINK_KINDS) expect(dict.links?.[kind], kind).toBeTruthy()
  })

  it('ma nazwe kazdego statusu projektu', () => {
    for (const status of PROJECT_STATUSES) {
      expect(dict.catalog?.status?.[status], status).toBeTruthy()
    }
  })

  it('ma tresc kazdego powiadomienia', () => {
    for (const kind of Object.keys(NOTIFICATION_ICONS)) {
      expect(dict.notifications?.[kind], kind).toBeTruthy()
    }
  })

  it('ma komplet kazdego dokumentu prawnego', () => {
    for (const { id } of LEGAL_DOCUMENTS) {
      const doc = dict[id]
      expect(doc, id).toBeTruthy()
      expect(doc.title, `${id}.title`).toBeTruthy()
      expect(doc.intro, `${id}.intro`).toBeTruthy()
      expect(doc.updated, `${id}.updated`).toBeTruthy()
      expect(dict.legal?.summaries?.[id], `legal.summaries.${id}`).toBeTruthy()

      for (const [index, section] of (doc.sections ?? []).entries()) {
        expect(section.title, `${id}.sections[${index}].title`).toBeTruthy()
        expect(section.body?.length || section.points?.length, `${id}.sections[${index}]`).toBeTruthy()
      }
    }
  })

  it('opisuje kazde ciasteczko z tabeli', () => {
    const page = readFileSync('app/pages/cookies.vue', 'utf8')
    const names = [...page.matchAll(/name: '([^']+)', kind:/g)].map(m => m[1]!)

    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      expect(dict.cookies?.why?.[name.replace(/[.-]/g, '_')], name).toBeTruthy()
    }
  })
})

it('kazdy dokument prawny ma strone pod swoim adresem', () => {
  for (const { id, path } of LEGAL_DOCUMENTS) {
    const file = path === '/legal' ? 'app/pages/legal/index.vue' : `app/pages${path}.vue`
    expect(existsSync(file), `${id} -> ${file}`).toBe(true)
  }
})

// A document translated in one language and not the other reads as if half of it
// were withdrawn, which is the worst possible impression for a legal page.
it('oba jezyki maja tyle samo sekcji w kazdym dokumencie', () => {
  const [en, pl] = LOCALES.map(load)
  for (const { id } of LEGAL_DOCUMENTS) {
    expect(pl![id].sections.length, id).toBe(en![id].sections.length)
  }
})

it('oba jezyki maja te same klucze powiadomien', () => {
  const [en, pl] = LOCALES.map(load)
  expect(Object.keys(pl!.notifications).sort()).toEqual(Object.keys(en!.notifications).sort())
})
