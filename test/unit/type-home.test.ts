import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

// A type that lives inside a component makes everything needing the shape depend
// on the view: useProjectEditor imported CatalogProjectData out of
// catalog/Project.vue to describe its own return value, and DependentProject was
// declared twice — once in a component, once on the server — with nothing keeping
// the two the same. Shared shapes live in app/types.
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory()
    ? walk(join(dir, entry.name))
    : [join(dir, entry.name)]))
}

const sources = ['app', 'server', 'shared']
  .flatMap(walk)
  .filter(file => file.endsWith('.vue') || file.endsWith('.ts'))

const read = (file: string) => readFileSync(file, 'utf8')
const slash = (file: string) => file.split(sep).join('/')

describe('gdzie mieszkaja typy', () => {
  it('nikt nie importuje typu z komponentu', () => {
    const offenders = sources
      .filter(file => /import\s+type\s[\s\S]*?from\s+'[^']*\.vue'/.test(read(file)))
      .map(slash)

    expect(offenders).toEqual([])
  })

  it('komponenty nie eksportuja wspolnych ksztaltow', () => {
    const offenders = sources
      .filter(file => file.endsWith('.vue'))
      .filter(file => /^export\s+(interface|type)\s/m.test(read(file)))
      .map(slash)

    expect(offenders).toEqual([])
  })

  it('ksztalt zaleznego projektu ma jedno zrodlo po stronie klienta', () => {
    const declarations = sources
      .filter(file => file.startsWith('app'))
      .filter(file => /interface\s+DependentProject\b/.test(read(file)))
      .map(slash)

    expect(declarations).toEqual(['app/types/catalog.ts'])
  })
})
