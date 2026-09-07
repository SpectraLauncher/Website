import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// Hiding a link in the navigation is not a guard, and an integration test per
// route would need a database. This is the cheap version of the same guarantee
// and catches the real failure: somebody adds a route and forgets the guard. It
// reads files and runs nothing.
const GATED_DIRS = [
  'server/api/admin/catalog',
  'server/api/admin/verification',
  'server/api/catalog',
  'server/api/seller',
  'server/api/verification',
  'server/api/org',
  'server/api/v2',
]

// memberContext and editableProject are guards of their own — each calls
// requireCatalogRead and then resolves what the caller may do. They are accepted
// here only because the tests below pin that they really do call one.
const GATES = [
  'requireCatalogWrite(event)',
  'requireCatalogRead(event)',
  'requireAdmin(event)',
  'memberContext(event)',
  'editableProject(event,',
]

// A CORS preflight has no credentials to check, so it cannot call a user guard.
// It still must not answer 204 to a route that is closed, because that confirms
// the route exists — so the flag itself is its guard.
const PREFLIGHT_GATE = 'catalogIsPublic()'

function walk(dir: string): string[] {
  let out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) out = out.concat(walk(path))
    else if (entry.name.endsWith('.ts')) out.push(path)
  }
  return out
}

function routeFiles(): string[] {
  return GATED_DIRS.flatMap((dir) => {
    try {
      return walk(dir)
    } catch {
      return []
    }
  })
}

describe('kazda trasa katalogu ma straznika', () => {
  const files = routeFiles()

  it('w ogole znajduje trasy do sprawdzenia', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s wola straznika', (file) => {
    const source = readFileSync(file, 'utf8')
    const gates = file.endsWith('.options.ts') ? [PREFLIGHT_GATE] : GATES
    expect(gates.some(gate => source.includes(gate))).toBe(true)
  })

  // defineCachedEventHandler stores the response and skips the handler on a
  // hit, which skips the guard with it: the first admin request fills the cache
  // and the next anonymous one reads from it.
  it.each(files)('%s nie cachuje odpowiedzi przed straznikiem', (file) => {
    expect(readFileSync(file, 'utf8')).not.toContain('defineCachedEventHandler')
  })
})

describe('opakowania straznikow same wolaja straznika', () => {
  it('memberContext wola requireCatalogRead', () => {
    const source = readFileSync('server/utils/organization.ts', 'utf8')
    const start = source.indexOf('export async function memberContext')
    expect(start).toBeGreaterThan(-1)

    const body = source.slice(start, start + 900)
    expect(body).toContain('requireCatalogRead(event)')
  })

  it('editableProject wola requireCatalogRead i sprawdza uprawnienie', () => {
    const source = readFileSync('server/utils/project-rights.ts', 'utf8')
    const start = source.indexOf('export async function editableProject')
    expect(start).toBeGreaterThan(-1)

    const body = source.slice(start, start + 900)
    expect(body).toContain('requireCatalogRead(event)')
    expect(body).toContain('requireProjectPermission(')
  })
})
