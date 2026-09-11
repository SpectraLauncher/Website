import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CATALOG_TYPES, catalogTypeByPrefix } from '../../app/utils/catalogTypes'
import { PROJECT_TYPES, TYPE_PREFIX } from '../../shared/utils/catalog-types'

describe('rejestr typow katalogu', () => {
  it('pokrywa kazdy typ projektu, raz', () => {
    expect(CATALOG_TYPES.map(entry => entry.type).sort())
      .toEqual([...PROJECT_TYPES].sort())
  })

  it('adres kazdego wpisu zgadza sie z TYPE_PREFIX, ktory zna serwer', () => {
    for (const entry of CATALOG_TYPES) {
      expect(TYPE_PREFIX[entry.type], entry.type).toBe(entry.prefix)
    }
  })

  it('prefiksy sa unikalne', () => {
    expect(new Set(CATALOG_TYPES.map(e => e.prefix)).size).toBe(CATALOG_TYPES.length)
  })
})

// app/pages/[type] answers any first segment, so anything it does not recognise
// has to come back null and let the page throw a 404. Without that, /nonsense
// renders an empty listing and /nonsense/thing fetches a project by that slug.
describe('nieznany segment nie jest typem', () => {
  it('zna swoje prefiksy', () => {
    for (const entry of CATALOG_TYPES) {
      expect(catalogTypeByPrefix(entry.prefix)?.type, entry.prefix).toBe(entry.type)
    }
  })

  it('odrzuca wszystko inne', () => {
    for (const value of ['', ' ', 'mods', 'Mod', 'nonsense', null, undefined, 42, ['mod']]) {
      expect(catalogTypeByPrefix(value), String(value)).toBeNull()
    }
  })

  // A static page directory wins over [type] in the router, but only while the
  // page exists. Naming one of them as a type would hijack it silently.
  it('nie zabiera adresu zadnej innej stronie', () => {
    const taken = readdirSync('app/pages', { withFileTypes: true })
      .filter(entry => entry.name !== '[type]')
      .map(entry => entry.name.replace(/\.vue$/, ''))

    const clashes = CATALOG_TYPES.filter(entry => taken.includes(entry.prefix))
    expect(clashes.map(entry => entry.prefix)).toEqual([])
  })
})

// The catalog gate and the admin gate were copies of each other, and a copy is
// one edit away from two gates that disagree about what a 401 means. They read
// from one place now; this keeps them there.
describe('bramy tras', () => {
  // A comment explaining why 403 is the wrong answer is not itself a 403.
  const gate = readFileSync('app/utils/routeGate.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  it.each(['admin', 'catalog'])('middleware %s idzie przez wspolna brame', (name) => {
    const source = readFileSync(`app/middleware/${name}.ts`, 'utf8')

    expect(source).toContain('gateRoute(')
    expect(source).not.toContain('createError')
    expect(source).not.toContain('navigateTo')
  })

  it('brama odroznia 401 od reszty i nigdy nie mowi 403', () => {
    expect(gate).toContain('status === 401')
    expect(gate).toContain('statusCode: 404')
    expect(gate).not.toContain('403')
  })

  it('brama dokłada ciasteczka przy renderze na serwerze', () => {
    expect(gate).toContain("useRequestHeaders(['cookie'])")
  })
})
