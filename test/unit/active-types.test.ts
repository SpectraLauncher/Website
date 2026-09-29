import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ exec: vi.fn(), one: vi.fn(), q: vi.fn(), usePool: vi.fn() }))

const db = await import('../../server/utils/db')
const catalog = await import('../../server/utils/catalog')
const { visibleProject } = await import('../../server/utils/catalog-public')
const {
  ACTIVE_TYPES,
  CATEGORIES,
  PROJECT_TYPES,
  isActiveType,
  loadersForType,
} = await import('../../shared/utils/catalog-types')

const admin = { id: 'a1', role: 'admin' }

const project = (type: string, status = 'published') =>
  ({ id: 'p1', type, status, owner_id: 'u1', org_id: null }) as never

beforeEach(() => {
  vi.mocked(db.one).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(db.q).mockReset().mockResolvedValue([] as never)
})

describe('ACTIVE_TYPES', () => {
  it('na razie otwiera tylko addony', () => {
    expect(ACTIVE_TYPES).toEqual(['addon'])
  })

  it('zawiera wylacznie znane typy', () => {
    for (const type of ACTIVE_TYPES) expect(PROJECT_TYPES, type).toContain(type)
  })

  it('addon ma swoj loader i kategorie', () => {
    expect(loadersForType('addon')).toEqual(['spectra'])
    expect(CATEGORIES.addon.length).toBeGreaterThan(0)
  })

  it('straznik odrzuca stare typy i smieci', () => {
    expect(isActiveType('addon')).toBe(true)
    for (const value of ['mod', 'plugin', 'schematic', 'nonsense', null, ['addon']]) {
      expect(isActiveType(value), String(value)).toBe(false)
    }
  })
})

describe('wylaczony typ nie istnieje dla nikogo', () => {
  it('opublikowany mod jest niewidoczny nawet dla admina', async () => {
    expect(await visibleProject(project('mod'), admin)).toBe(false)
    expect(await visibleProject(project('mod'), null)).toBe(false)
  })

  it('opublikowany addon jest widoczny', async () => {
    expect(await visibleProject(project('addon'), null)).toBe(true)
  })

  it('wyszukanie po slugu i id pyta tylko o aktywne typy', async () => {
    await catalog.projectByIdOrSlug('some-slug')
    const [sql, params] = vi.mocked(db.one).mock.calls[0]!
    expect(sql).toMatch(/type = ANY\(\$2\)/)
    expect(params).toEqual(['some-slug', ACTIVE_TYPES])
  })

  it('lista projektow zawsze zaweza do aktywnych typow', async () => {
    vi.mocked(db.one).mockResolvedValue({ n: 0 } as never)
    await catalog.listProjects({})
    const [sql, params] = vi.mocked(db.one).mock.calls[0]!
    expect(sql).toMatch(/type = ANY\(\$\d+\)/)
    expect(params).toContainEqual(ACTIVE_TYPES)
  })

  it('projekty wlasciciela i kolejka tez', async () => {
    await catalog.ownedProjects('u1', [])
    await catalog.queueCounts()
    for (const [sql, params] of vi.mocked(db.q).mock.calls) {
      expect(sql).toMatch(/type = ANY\(\$\d+\)/)
      expect(params).toContainEqual(ACTIVE_TYPES)
    }
  })

  it('nie da sie zalozyc projektu wylaczonego typu', async () => {
    await expect(catalog.createProject({ type: 'mod', title: 'x' }, 'u1'))
      .rejects.toMatchObject({ statusCode: 400 })
  })
})
