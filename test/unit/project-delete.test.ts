import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { API_ENDPOINTS } from '../../shared/utils/api-reference'

vi.mock('../../server/utils/db', () => ({ exec: vi.fn(), one: vi.fn(), q: vi.fn(), usePool: vi.fn() }))
vi.mock('../../server/utils/r2', () => ({
  r2Delete: vi.fn(),
  r2Put: vi.fn(),
  useR2: () => ({ publicUrl: 'https://cdn.test' }),
}))

const db = await import('../../server/utils/db')
const r2 = await import('../../server/utils/r2')
const { deleteProject, deleteVersion } = await import('../../server/utils/catalog')

const CDN = 'https://cdn.test'
const order: string[] = []

function database(rows: Record<string, unknown[]>, single: Record<string, unknown>) {
  const pick = <T>(table: Record<string, T>, sql: string) => Object.entries(table).find(([key]) => sql.includes(key))?.[1]
  vi.mocked(db.q).mockImplementation((async (sql: string) => pick(rows, sql) ?? []) as never)
  vi.mocked(db.one).mockImplementation((async (sql: string) => pick(single, sql) ?? null) as never)
  vi.mocked(db.exec).mockImplementation((async (sql: string) => {
    order.push(sql.trim().split(/\s+/).slice(0, 3).join(' '))
    return 1
  }) as never)
}

const deleted = () => vi.mocked(r2.r2Delete).mock.calls.map(call => call[1])

beforeEach(() => {
  order.length = 0
  vi.mocked(r2.r2Delete).mockReset().mockImplementation((async (_: unknown, key: string) => {
    order.push(`r2 ${key}`)
    return true
  }) as never)
})

describe('usuniecie projektu sprzata R2', () => {
  it('zabiera pliki wersji, ikone, baner i galerie, ale zostawia pliki uzywane gdzie indziej', async () => {
    database({
      'FROM version_file f': [
        { object_key: 'content/aa/shared/a.jar', sha512: 'shared' },
        { object_key: 'content/bb/own/b.jar', sha512: 'own' },
      ],
      'FROM stored_image': [{ object_key: 'catalog/body/p1/x.webp' }, { object_key: 'catalog/gallery/p1/g.webp' }],
      'FROM project_gallery': [{ url: `${CDN}/catalog/gallery/p1/g.webp?v=1` }],
      'FROM version_file WHERE object_key': [{ object_key: 'content/aa/shared/a.jar', sha512: 'shared' }],
    }, {
      'SELECT type, icon, banner': { type: 'mod', icon: `${CDN}/catalog/icons/p1.webp?v=2`, banner: `${CDN}/catalog/banners/p1.webp` },
    })

    await deleteProject('p1')

    expect(deleted().sort()).toEqual([
      'catalog/banners/p1.webp',
      'catalog/body/p1/x.webp',
      'catalog/gallery/p1/g.webp',
      'catalog/icons/p1.webp',
      'content/bb/own/b.jar',
    ])
    expect(order[0]).toBe('DELETE FROM project')
  })

  it('schemat zabiera tez swoj podglad, a ikona spoza katalogu zostaje', async () => {
    database({
      'FROM version_file f': [{ object_key: 'content/cc/build/house.schem', sha512: 'ccbuild' }],
    }, {
      'SELECT type, icon, banner': { type: 'schematic', icon: `${CDN}/content/dd/other/icon.png`, banner: null },
    })

    await deleteProject('p2')

    expect(deleted().sort()).toEqual(['content/cc/build/house.schem', 'content/preview/cc/ccbuild.json'])
  })

  it('nieistniejacy projekt nie rusza niczego', async () => {
    database({}, {})
    await deleteProject('nope')
    expect(order).toEqual([])
  })

  it('usuniecie wersji zabiera jej pliki, jesli nikt inny ich nie ma', async () => {
    database({
      'FROM version_file WHERE version_id': [{ object_key: 'content/ee/solo/c.jar', sha512: 'solo' }],
    }, {
      'FROM version': { id: 'v1', project_id: 'p3' },
      'SELECT type FROM project': { type: 'mod' },
    })

    await deleteVersion('v1')

    expect(deleted()).toEqual(['content/ee/solo/c.jar'])
    expect(order.indexOf('DELETE FROM version')).toBeLessThan(order.indexOf('r2 content/ee/solo/c.jar'))
  })
})

describe('usuwanie wlasnego projektu', () => {
  const route = readFileSync('server/api/catalog/project/[slug].delete.ts', 'utf8')
  const page = readFileSync('app/pages/[type]/[slug]/settings/index.vue', 'utf8')

  it('trasa jest za flaga katalogu i wymaga prawa do usuniecia', () => {
    expect(route).toContain(`editableProject(event, 'delete_project')`)
    expect(route.indexOf('editableProject(')).toBeLessThan(route.indexOf('deleteProject('))
  })

  it('usuwa ten sam projekt, ktory sprawdzila', () => {
    expect(route).toContain('deleteProject(project.id)')
  })

  it('przycisk widzi tylko ktos, komu serwer na to pozwoli, i musi potwierdzic', () => {
    expect(page).toContain(`v-if="may('delete_project')"`)
    expect(page).toContain('danger: true')
    expect(page.indexOf('await ask(')).toBeLessThan(page.indexOf(`method: 'DELETE'`))
  })

  it('jest w dokumentacji api', () => {
    expect(API_ENDPOINTS.map(r => r.route)).toContain('DELETE /api/catalog/project/{slug}')
  })
})
