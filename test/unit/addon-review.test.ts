import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { addonCodeFiles } from '../../server/utils/addon-manifest'
import { type Zip, openZip } from '../../server/utils/zip'
import { ADDON_REVIEW_ITEMS, addonReviewDone } from '../../shared/utils/addon-install'
import { fixture, hasFixtures } from '../fixtures'

function zipOf(files: Record<string, string>): Zip {
  return {
    entries: Object.entries(files).map(([name, text]) => ({
      name,
      method: 0,
      compressedSize: text.length,
      uncompressedSize: text.length,
      localHeaderOffset: 0,
    })),
    has: name => name in files,
    read: name => (name in files ? Buffer.from(files[name]!) : null),
    readText: name => files[name] ?? null,
    readJson: () => null,
  }
}

describe('pliki kodu addonu dla moderatora', () => {
  it('wypisuje tylko skrypty, strony i wasm', () => {
    const files = addonCodeFiles(zipOf({
      'addon.json': '{}',
      'main.js': 'spectra.ui.toast("hi")\n',
      'ui/page.html': '<p>x</p>',
      'backend.wasm': '\0asm',
      'icons/a.svg': '<svg/>',
      'style.css': 'a{}',
      'ui/': '',
    }))
    expect(files.map(f => f.name)).toEqual(['backend.wasm', 'main.js', 'ui/page.html'])
    expect(files.find(f => f.name === 'main.js')).toMatchObject({ size: 23, minified: false, dynamic: false })
  })

  it('oznacza zminifikowany kod', () => {
    const [file] = addonCodeFiles(zipOf({ 'main.js': `var a=1;${'b();'.repeat(400)}` }))
    expect(file!.minified).toBe(true)
  })

  it.each([
    'eval(atob(x))',
    'const f = new Function("return 1")',
    'setTimeout("alert(1)", 10)',
  ])('oznacza kod skladany z tekstu: %s', (source) => {
    expect(addonCodeFiles(zipOf({ 'main.js': source }))[0]!.dynamic).toBe(true)
  })

  it('nie oznacza zwyklych nazw', () => {
    const [file] = addonCodeFiles(zipOf({ 'main.js': 'retrieval(1); setTimeout(() => go(), 10); medieval()' }))
    expect(file!.dynamic).toBe(false)
  })

  it('wasm nie jest czytany jako tekst', () => {
    const [file] = addonCodeFiles(zipOf({ 'backend.wasm': 'eval(' }))
    expect(file).toMatchObject({ minified: false, dynamic: false })
  })

  it.skipIf(!hasFixtures('sample-addon.zip'))('dziala na prawdziwej paczce', () => {
    const files = addonCodeFiles(openZip(fixture('sample-addon.zip')))
    expect(files.map(f => f.name)).toEqual([
      'backend.wasm',
      'main.js',
      'ui/overlay.html',
      'ui/settings.html',
      'ui/stats.html',
      'ui/tab.html',
    ])
  })
})

describe('lista kontrolna przed zatwierdzeniem addonu', () => {
  it('wymaga kazdego punktu', () => {
    expect(addonReviewDone([...ADDON_REVIEW_ITEMS])).toBe(true)
    expect(addonReviewDone(ADDON_REVIEW_ITEMS.slice(1))).toBe(false)
    expect(addonReviewDone([])).toBe(false)
    expect(addonReviewDone(undefined)).toBe(false)
    expect(addonReviewDone('permissions,network,code,backend')).toBe(false)
  })

  it('serwer odrzuca zatwierdzenie addonu bez listy', () => {
    const source = readFileSync('server/api/admin/catalog/projects/[id]/moderate.post.ts', 'utf8')
    const gate = source.indexOf("project.type === 'addon' && !addonReviewDone(body.review)")
    expect(gate).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(source.indexOf('updateProject('))
  })

  it('pliki kodu widzi tylko moderacja', () => {
    const source = readFileSync('server/api/admin/catalog/versions/[id]/code.get.ts', 'utf8')
    expect(source.indexOf('requireModeration(event)')).toBeLessThan(source.indexOf('filesForVersions'))
  })
})
