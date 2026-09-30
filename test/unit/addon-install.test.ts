import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ADDON_PERMISSIONS } from '../../server/utils/addon-manifest'
import { addonAccess, addonInstallLink, permissionKey } from '../../shared/utils/addon-install'

const load = (loc: string) =>
  JSON.parse(readFileSync(`i18n/locales/${loc}.json`, 'utf8')) as Record<string, any>

describe('instalacja addonu z katalogu', () => {
  it('link otwiera launcher na tym addonie', () => {
    expect(addonInstallLink('better-stats')).toBe('spectra://addon/better-stats')
  })

  it('czyta uprawnienia i hosty z metadanych wersji', () => {
    const access = addonAccess({
      permissions: ['instances:read', 'network:api.example.com'],
      main: 'main.js',
      contributes: {},
    })
    expect(access).toEqual({
      permissions: ['instances:read'],
      hosts: ['api.example.com'],
      runsCode: true,
    })
  })

  it('motyw z linkiem nie uruchamia kodu', () => {
    const access = addonAccess({
      permissions: [],
      contributes: {
        themes: [{ id: 't' }],
        buttons: [{ action: { type: 'url', url: 'https://x.com' } }],
      },
    })
    expect(access).toEqual({ permissions: [], hosts: [], runsCode: false })
  })

  it('kazdy slot z widokiem albo akcja inna niz link to kod', () => {
    for (const contributes of [
      { pages: [{}] },
      { instanceTabs: [{}] },
      { settings: 'ui/settings.html' },
      { windows: [{}] },
      { buttons: [{ action: { type: 'command', command: 'go' } }] },
    ]) {
      expect(addonAccess({ contributes }).runsCode, JSON.stringify(contributes)).toBe(true)
    }
  })

  it('nie wysypuje sie na brakujacych metadanych', () => {
    expect(addonAccess(null)).toEqual({ permissions: [], hosts: [], runsCode: false })
    expect(addonAccess({ permissions: 'nope' })).toEqual({ permissions: [], hosts: [], runsCode: false })
  })

  it.each(['en', 'pl'])('%s opisuje kazde uprawnienie z parsera', (loc) => {
    const labels = load(loc).catalog.addonAccess.permissions
    for (const permission of ADDON_PERMISSIONS) {
      expect(labels[permissionKey(permission)], permission).toBeTruthy()
    }
  })

  it('strona addonu daje przycisk instalacji, a panel pokazuje dostep', () => {
    const page = readFileSync('app/components/catalog/Project.vue', 'utf8')
    const sidebar = readFileSync('app/components/project/Sidebar.vue', 'utf8')
    expect(page).toContain(`v-if="project.type === 'addon' && primaryFile"`)
    expect(page).toContain('addonInstallLink(project.slug)')
    expect(sidebar).toContain("props.project.type === 'addon'")
    expect(sidebar).toContain('addonAccess(latest.value.meta)')
  })
})
