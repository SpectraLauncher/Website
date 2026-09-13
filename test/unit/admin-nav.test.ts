import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ADMIN_NAV, adminNavCurrent } from '../../app/utils/adminNav'
import { atLeast } from '../../shared/utils/staff-roles'

const read = (file: string) => readFileSync(file, 'utf8')
const slash = (file: string) => file.split(sep).join('/')

const pages = readdirSync('app/pages/admin', { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.vue'))
  .map(entry => join('app/pages/admin', entry.name))

describe('nawigacja panelu', () => {
  // The bug: the registry lived inside /admin, so every other page of the panel
  // rendered without a sidebar and the only way back was the browser.
  it('kazda strona panelu siedzi na layoucie', () => {
    const without = pages
      .filter(file => !/layout: 'admin'/.test(read(file)))
      .map(slash)

    expect(without).toEqual([])
  })

  it('zadna strona nie rysuje wlasnego sidebara ani powloki', () => {
    const own = pages
      .filter(file => /<UiSideNav|<UiPageShell/.test(read(file)))
      .map(slash)

    expect(own).toEqual([])
  })

  it('kazdy wpis z adresem ma swoja strone', () => {
    const files = new Set(pages.map(file => slash(file)))

    for (const entry of ADMIN_NAV) {
      if (!entry.to) continue
      const name = entry.to.split('?')[0]!.replace('/admin/', '')
      expect(files.has(`app/pages/admin/${name}.vue`), entry.id).toBe(true)
    }
  })

  it('wpis bez adresu jest zakladka na /admin', () => {
    const index = read('app/pages/admin/index.vue')

    for (const entry of ADMIN_NAV.filter(e => !e.to)) {
      expect(index, entry.id).toContain(`tab === '${entry.id}'`)
    }
  })

  it('adres wskazuje wlasciwa pozycje', () => {
    expect(adminNavCurrent('/admin/catalog')).toBe('catalog')
    expect(adminNavCurrent('/pl/admin/finance')).toBe('finance')
    // one page, two sections: ?kind is what tells them apart
    expect(adminNavCurrent('/admin/posts')).toBe('posts')
    expect(adminNavCurrent('/admin/posts', { kind: 'newsletter' })).toBe('newsletter')
    expect(adminNavCurrent('/admin')).toBe('')
  })

  it('moderator widzi tylko to, co moze otworzyc', () => {
    const forModerator = ADMIN_NAV
      .filter(entry => atLeast({ role: 'moderator' }, entry.need))
      .map(entry => entry.id)

    expect(forModerator.sort()).toEqual(['catalog', 'verification'])
  })

  it('wlasciciel widzi wszystko, co admin', () => {
    const admin = ADMIN_NAV.filter(e => atLeast({ role: 'admin' }, e.need)).length
    const owner = ADMIN_NAV.filter(e => atLeast({ role: 'owner' }, e.need)).length

    expect(owner).toBe(ADMIN_NAV.length)
    expect(owner).toBe(admin)
  })
})
