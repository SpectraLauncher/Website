import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PROJECT_STATUSES } from '../../server/utils/catalog-types'
import { NOTIFICATION_ICONS } from '../../app/composables/useNotifications'
import { LINK_KINDS } from '../../shared/utils/links'

const LOCALES = ['en', 'pl'] as const
const load = (loc: string) =>
  JSON.parse(readFileSync(`i18n/locales/${loc}.json`, 'utf8')) as Record<string, any>

// Rejestry rosna po stronie kodu, a tlumaczenia zostaja w tyle — wtedy interfejs
// pokazuje goly klucz. Kazdy rejestr, po ktorym renderujemy petla, jest tu.
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
})

it('oba jezyki maja te same klucze powiadomien', () => {
  const [en, pl] = LOCALES.map(load)
  expect(Object.keys(pl!.notifications).sort()).toEqual(Object.keys(en!.notifications).sort())
})
