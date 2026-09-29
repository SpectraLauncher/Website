import { describe, expect, it } from 'vitest'

import {
  ADDON_PERMISSIONS,
  ADDON_SLOTS,
  AddonManifestError,
  addonMeta,
  readAddonManifest,
} from '../../server/utils/addon-manifest'
import { type Zip, openZip } from '../../server/utils/zip'
import { fixture, hasFixtures } from '../fixtures'

function fakeZip(files: Record<string, unknown>): Zip {
  const text = (name: string) => {
    const value = files[name]
    if (value === undefined) return null
    return typeof value === 'string' ? value : JSON.stringify(value)
  }
  return {
    entries: [],
    has: name => name in files,
    read: name => (text(name) === null ? null : Buffer.from(text(name)!)),
    readText: text,
    readJson: <T>(name: string) => (text(name) === null ? null : JSON.parse(text(name)!) as T),
  }
}

const base = {
  id: 'my-addon',
  name: 'My addon',
  version: '1.0.0',
  api: 1,
  main: 'main.js',
}

const withManifest = (manifest: Record<string, unknown>, extra: Record<string, string> = {}) =>
  fakeZip({ 'addon.json': manifest, 'main.js': '', ...extra })

const rejects = (manifest: Record<string, unknown>, extra?: Record<string, string>) =>
  expect(() => readAddonManifest(withManifest(manifest, extra)))

describe.skipIf(!hasFixtures('sample-addon.zip'))('addon.json z prawdziwego archiwum', () => {
  const manifest = readAddonManifest(openZip(fixture('sample-addon.zip')))!

  it('czyta tozsamosc i wersje', () => {
    expect(manifest).toMatchObject({
      id: 'better-stats',
      name: 'Better Stats',
      version: '1.2.0',
      api: 1,
      launcher: '>=0.10.0',
      main: 'main.js',
      backend: 'backend.wasm',
    })
  })

  it('uprawnienia sa bez powtorzen i posortowane', () => {
    expect(manifest.permissions).toEqual(['instances:read', 'network:api.example.com'])
  })

  it('czyta wszystko, co addon dokłada do launchera', () => {
    expect(manifest.contributes.pages).toEqual([
      { id: 'stats', title: 'Stats', icon: 'icons/chart.svg', entry: 'ui/stats.html' },
    ])
    expect(manifest.contributes.instanceTabs[0]!.entry).toBe('ui/tab.html')
    expect(manifest.contributes.settings).toBe('ui/settings.html')
    expect(manifest.contributes.themes).toEqual([
      { id: 'midnight', name: 'Midnight', file: 'themes/midnight.json' },
    ])
    expect(manifest.contributes.locales).toEqual({ pl: 'locales/pl.json' })
  })

  it('czyta przyciski w slotach i okna', () => {
    expect(manifest.contributes.buttons.map(b => [b.slot, b.action.type])).toEqual([
      ['sidebar.menu', 'page'],
      ['titlebar', 'window'],
      ['instance.header', 'url'],
    ])
    expect(manifest.contributes.windows).toEqual([
      { id: 'overlay', title: 'Overlay', entry: 'ui/overlay.html', width: 420, height: 300, resizable: true },
    ])
  })

  it('metadane wersji niosa id addonu i uprawnienia', () => {
    expect(addonMeta(manifest)).toMatchObject({
      addonId: 'better-stats',
      api: 1,
      permissions: ['instances:read', 'network:api.example.com'],
    })
  })
})

describe('addon.json', () => {
  it('archiwum bez manifestu nie jest addonem', () => {
    expect(readAddonManifest(fakeZip({ 'pack.mcmeta': '{}' }))).toBeNull()
  })

  it('przyjmuje minimalny addon', () => {
    expect(readAddonManifest(withManifest(base))?.id).toBe('my-addon')
  })

  it('addon z samym motywem nie potrzebuje kodu', () => {
    const manifest = readAddonManifest(fakeZip({
      'addon.json': {
        ...base,
        main: undefined,
        contributes: { themes: [{ id: 'dark', name: 'Dark', file: 'dark.json' }] },
      },
      'dark.json': '{}',
    }))
    expect(manifest?.main).toBeNull()
    expect(manifest?.contributes.themes).toHaveLength(1)
  })

  it('odrzuca niepoprawny JSON', () => {
    expect(() => readAddonManifest(fakeZip({ 'addon.json': '{nope' })))
      .toThrow(AddonManifestError)
  })

  it.each([
    ['Big Addon'],
    ['-dash'],
    ['dash-'],
    ['a'.repeat(65)],
    [''],
  ])('odrzuca id %s', (id) => {
    rejects({ ...base, id }).toThrow(AddonManifestError)
  })

  it('wymaga nazwy i wersji', () => {
    rejects({ ...base, name: undefined }).toThrow(/name/)
    rejects({ ...base, version: '' }).toThrow(/version/)
    rejects({ ...base, version: '1.0 beta' }).toThrow(/version/)
  })

  it('zna tylko wspierane wersje API', () => {
    rejects({ ...base, api: 2 }).toThrow(/api/)
    rejects({ ...base, api: '1' }).toThrow(/api/)
  })

  it('sciezki musza istniec w archiwum', () => {
    rejects({ ...base, main: 'missing.js' }).toThrow(/not in the archive/)
  })

  it('sciezki nie wychodza poza archiwum', () => {
    rejects({ ...base, main: '../main.js' }).toThrow(/inside the archive/)
    rejects({ ...base, main: '/etc/main.js' }).toThrow(/inside the archive/)
    rejects({ ...base, main: 'C:/main.js' }).toThrow(/inside the archive/)
  })

  it('pilnuje rozszerzen plikow', () => {
    rejects({ ...base, main: 'main.exe' }, { 'main.exe': '' }).toThrow(/\.js/)
    rejects({ ...base, backend: 'lib.dll' }, { 'lib.dll': '' }).toThrow(/\.wasm/)
    rejects({ ...base, contributes: { settings: 'settings.js' } }).toThrow(/\.html/)
  })

  it('przyjmuje kazde znane uprawnienie i domeny sieci', () => {
    const manifest = readAddonManifest(withManifest({
      ...base,
      permissions: [...ADDON_PERMISSIONS, 'network:api.example.com', 'network:cdn.example.co.uk'],
    }))
    expect(manifest?.permissions).toHaveLength(ADDON_PERMISSIONS.length + 2)
  })

  it.each([
    ['fs:write'],
    ['network:*'],
    ['network:*.example.com'],
    ['network:https://example.com'],
    ['network:localhost'],
    ['network:example.com/path'],
  ])('odrzuca uprawnienie %s', (permission) => {
    rejects({ ...base, permissions: [permission] }).toThrow(/permission/)
  })

  it('nie przepuszcza powtorzonych id w jednym slocie', () => {
    rejects({
      ...base,
      contributes: {
        pages: [
          { id: 'a', title: 'A', entry: 'a.html' },
          { id: 'a', title: 'B', entry: 'a.html' },
        ],
      },
    }, { 'a.html': '' }).toThrow(/repeats/)
  })

  it('ogranicza liczbe wpisow', () => {
    const pages = Array.from({ length: 21 }, (_, i) => ({ id: `p${i}`, title: 'x', entry: 'a.html' }))
    rejects({ ...base, contributes: { pages } }, { 'a.html': '' }).toThrow(/more than/)
  })

  it('odrzuca nieznany kod jezyka', () => {
    rejects({ ...base, contributes: { locales: { polish: 'pl.json' } } }, { 'pl.json': '{}' })
      .toThrow(/language/)
  })

  describe('przyciski', () => {
    const button = (over: Record<string, unknown>) => ({
      ...base,
      main: undefined,
      contributes: {
        buttons: [{ id: 'b', slot: 'sidebar.menu', title: 'B', action: { type: 'url', url: 'https://example.com' }, ...over }],
      },
    })

    it('przycisk z linkiem wystarcza za caly addon', () => {
      expect(readAddonManifest(withManifest(button({})))?.contributes.buttons[0]!.action)
        .toEqual({ type: 'url', url: 'https://example.com/' })
    })

    it.each(ADDON_SLOTS.map(slot => [slot]))('zna slot %s', (slot) => {
      expect(readAddonManifest(withManifest(button({ slot })))?.contributes.buttons[0]!.slot).toBe(slot)
    })

    it('odrzuca nieznany slot', () => {
      rejects(button({ slot: 'everywhere' })).toThrow(/not a place/)
    })

    it.each([
      ['http://example.com'],
      ['javascript:alert(1)'],
      ['https://user:pass@example.com'],
      ['file:///C:/Windows'],
      ['nie adres'],
    ])('link %s nie przechodzi', (url) => {
      rejects(button({ action: { type: 'url', url } })).toThrow(/url/)
    })

    it('akcja musi wskazywac cos, co addon ma', () => {
      rejects(button({ action: { type: 'page', page: 'nope' } })).toThrow(/page the addon does not have/)
      rejects(button({ action: { type: 'window', window: 'nope' } })).toThrow(/window the addon does not have/)
      rejects(button({ action: { type: 'command', command: 'go' } })).toThrow(/needs main/)
      rejects(button({ action: { type: 'shell', command: 'rm' } })).toThrow(/type/)
    })

    it('ikona to obrazek z paczki', () => {
      rejects(button({ icon: 'icon.exe' }), { 'icon.exe': '' }).toThrow(/\.svg/)
      rejects(button({ icon: 'missing.png' })).toThrow(/not in the archive/)
    })
  })

  it('okno ma rozsadny rozmiar', () => {
    const win = (over: Record<string, unknown>) => ({
      ...base,
      contributes: { windows: [{ id: 'w', title: 'W', entry: 'w.html', ...over }] },
    })
    expect(readAddonManifest(withManifest(win({}), { 'w.html': '' }))?.contributes.windows[0]!.resizable).toBe(true)
    rejects(win({ width: 50 }), { 'w.html': '' }).toThrow(/between/)
    rejects(win({ height: 1.5 }), { 'w.html': '' }).toThrow(/between/)
  })

  it('zakres wersji launchera moze miec kilka warunkow', () => {
    expect(readAddonManifest(withManifest({ ...base, launcher: '>=0.10.0, <2.0.0' }))?.launcher).toBe('>=0.10.0, <2.0.0')
  })

  it('addon, ktory niczego nie dokłada, jest bledem', () => {
    rejects({ ...base, main: undefined }).toThrow(/contribute/)
  })
})
