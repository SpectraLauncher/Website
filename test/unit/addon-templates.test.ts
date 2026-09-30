import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readAddonManifest } from '../../server/utils/addon-manifest'
import { openZip, writeZip } from '../../server/utils/zip'
import { ADDON_TEMPLATES, isAddonTemplate } from '../../shared/utils/addon-install'

const BASE = 'server/assets/addon-templates'

function filesOf(dir: string): Array<{ name: string, data: Buffer }> {
  const out: Array<{ name: string, data: Buffer }> = []
  const walk = (at: string) => {
    for (const entry of readdirSync(at)) {
      const path = join(at, entry)
      if (statSync(path).isDirectory()) walk(path)
      else out.push({ name: relative(dir, path).split('\\').join('/'), data: readFileSync(path) })
    }
  }
  walk(dir)
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

describe('zapis zipa', () => {
  it('to, co zapisze, czyta z powrotem ten sam czytnik co uploady', () => {
    const files = [
      { name: 'addon.json', data: Buffer.from('{"a":1}') },
      { name: 'ui/żółw.html', data: Buffer.from('<p>' + 'x'.repeat(5000) + '</p>') },
      { name: 'empty.txt', data: Buffer.alloc(0) },
    ]
    const zip = openZip(writeZip(files))
    expect(zip.entries.map(e => e.name)).toEqual(files.map(f => f.name))
    for (const file of files) expect(zip.read(file.name)?.equals(file.data), file.name).toBe(true)
  })
})

describe('szablony addonow', () => {
  it('kazdy zarejestrowany szablon ma folder i odwrotnie', () => {
    expect(readdirSync(BASE).sort()).toEqual([...ADDON_TEMPLATES].sort())
  })

  it.each(ADDON_TEMPLATES)('%s po spakowaniu przechodzi parser addonow', (name) => {
    const manifest = readAddonManifest(openZip(writeZip(filesOf(join(BASE, name)))))
    expect(manifest).not.toBeNull()
    expect(manifest!.launcher).toBe('>=1.0.0')
    expect(manifest!.id.startsWith('my-')).toBe(true)
  })

  it('backend ma zbudowany modul i zrodla', () => {
    const wasm = readFileSync(join(BASE, 'backend/backend.wasm'))
    expect(wasm.subarray(0, 4).equals(Buffer.from([0, 0x61, 0x73, 0x6d]))).toBe(true)
    expect(readFileSync(join(BASE, 'backend/backend/src/lib.rs'), 'utf8')).toContain('#[plugin_fn]')
  })

  it('nie da sie pobrac niczego spoza listy', () => {
    for (const name of ['../zip', 'theme/..', 'nope', '', 'THEME']) expect(isAddonTemplate(name), name).toBe(false)
  })

  it('pobieranie jest za straznikiem katalogu', () => {
    const route = readFileSync('server/api/catalog/addon-templates/[name].get.ts', 'utf8')
    expect(route.indexOf('requireCatalogRead(event)')).toBeLessThan(route.indexOf('useStorage('))
    expect(route).toContain('isAddonTemplate(name)')
  })
})
