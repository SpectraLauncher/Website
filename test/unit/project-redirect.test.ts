import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(file, 'utf8')
const slash = (file: string) => file.split(sep).join('/')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory()
    ? walk(join(dir, entry.name))
    : [join(dir, entry.name)]))
}

// /project/<id> is a permanent address that outlives a slug or a type change.
// It used to be a Vue page that fetched and then called navigateTo, so a crawler
// only saw the redirect if it ran the script.
describe('stały adres projektu', () => {
  const helper = read('server/utils/project-redirect.ts')

  it('nie jest juz strona', () => {
    expect(existsSync('app/pages/project')).toBe(false)
  })

  it('odpowiada prawdziwym 301 z serwera', () => {
    expect(helper).toMatch(/sendRedirect\(event,[\s\S]+?, 301\)/)
  })

  it('ma brame katalogu i te sama regule widocznosci, co endpoint', () => {
    expect(helper).toMatch(/requireCatalogRead\(event\)/)
    expect(helper).toMatch(/visibleProject\(project, viewer\)/)
    // a project nobody may open must not leak its slug through Location
    expect(helper).toMatch(/statusCode: 404/)
  })

  it('obie wersje jezykowe maja swoja trase', () => {
    expect(existsSync('server/routes/project/[id].get.ts')).toBe(true)
    expect(existsSync('server/routes/pl/project/[id].get.ts')).toBe(true)
    expect(read('server/routes/pl/project/[id].get.ts')).toContain("'/pl'")
  })

  it('kazda trasa w server/routes wola strażnika albo jest publiczna z rozmyslu', () => {
    const open = walk('server/routes')
      .filter(file => file.endsWith('.ts'))
      .filter(file => !/require(CatalogRead|CatalogWrite|Admin|Moderation|Owner|Staff)\(event\)/.test(read(file)))
      .filter(file => !/redirectToProject\(/.test(read(file)))
      .map(slash)

    // only the skin renderer, which is meant to be open
    expect(open).toEqual(['server/routes/render/[type]/[player]/[crop].get.ts'])
  })
})

describe('powrot po usunieciu wersji', () => {
  it('wraca pod prefiks typu, nie pod /project', () => {
    const source = read('app/pages/[type]/[slug]/settings/version/[version].vue')

    expect(source).not.toMatch(/`\/project\/\$\{/)
    expect(source).toMatch(/\$\{type\.value\}\/\$\{slug\.value\}\/settings\/versions/)
  })
})
