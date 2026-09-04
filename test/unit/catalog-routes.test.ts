import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// Ukrycie linku w nawigacji nie jest zabezpieczeniem, a test integracyjny na
// kazda trase wymagalby bazy. To jest tansza wersja tej samej gwarancji i lapie
// prawdziwy tryb awarii: ktos dodaje trase i zapomina o straznik. Skanuje pliki,
// nie odpala niczego.
const GATED_DIRS = [
  'server/api/admin/catalog',
  'server/api/admin/verification',
  'server/api/catalog',
  'server/api/verification',
  'server/api/org',
  'server/api/v2',
]

const GATES = ['requireCatalogWrite(event)', 'requireCatalogRead(event)', 'requireAdmin(event)']

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

  // defineCachedEventHandler zapisuje odpowiedz i przy trafieniu w cache nie
  // uruchamia handlera — czyli takze nie uruchamia straznika. Pierwsze wejscie
  // admina zapelnia cache, a nastepny anonim dostaje z niego dane. Trasa za
  // brama nie moze byc cachowana odpowiedzia.
  it.each(files)('%s nie cachuje odpowiedzi przed straznikiem', (file) => {
    expect(readFileSync(file, 'utf8')).not.toContain('defineCachedEventHandler')
  })
})
