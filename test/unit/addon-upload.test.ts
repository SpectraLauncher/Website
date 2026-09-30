import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fixture, hasFixtures } from '../fixtures'

vi.mock('../../server/utils/db', () => ({ exec: vi.fn(), one: vi.fn(), q: vi.fn(), usePool: vi.fn() }))
vi.mock('../../server/utils/content-store', () => ({ readContent: vi.fn(), storeDerived: vi.fn() }))

const db = await import('../../server/utils/db')
const store = await import('../../server/utils/content-store')
const { addonVersionInput, claimAddonId, readAddonFile } = await import('../../server/utils/addon-manifest')
const { analyzeUpload } = await import('../../server/utils/catalog-analyze')

beforeEach(() => {
  vi.mocked(db.exec).mockReset().mockResolvedValue(1 as never)
  vi.mocked(store.readContent).mockReset()
})

describe.skipIf(!hasFixtures('sample-addon.zip'))('wersja addonu z pliku', () => {
  it('analiza rozpoznaje addon i wypelnia formularz z manifestu', async () => {
    const analysis = await analyzeUpload(fixture('sample-addon.zip'), 'better-stats.zip')

    expect(analysis).toMatchObject({
      detected: 'addon',
      title: 'Better Stats',
      slug: 'better-stats',
      version: '1.2.0',
      loaders: [],
      gameVersions: [],
      environment: [],
    })
    expect(analysis.meta).toMatchObject({ addonId: 'better-stats', api: 1 })
  })

  it('numer, loader i metadane biora sie z pliku, nie z formularza', async () => {
    vi.mocked(store.readContent).mockResolvedValue(fixture('sample-addon.zip') as never)

    const manifest = await readAddonFile('some/key')
    expect(addonVersionInput(manifest)).toMatchObject({
      number: '1.2.0',
      loaders: [],
      gameVersions: [],
      meta: { addonId: 'better-stats', permissions: ['instances:read', 'network:api.example.com'] },
    })
  })
})

describe('plik wersji addonu', () => {
  it('brak pliku w magazynie to prosba o ponowny upload', async () => {
    vi.mocked(store.readContent).mockResolvedValue(null as never)
    await expect(readAddonFile('k')).rejects.toMatchObject({ statusCode: 409 })
  })

  it.skipIf(!hasFixtures('zip-comment.zip'))('plik bez addon.json jest odrzucany', async () => {
    const zip = fixture('zip-comment.zip')
    vi.mocked(store.readContent).mockResolvedValue(zip as never)
    await expect(readAddonFile('k')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('smieci zamiast archiwum daja 400, nie 500', async () => {
    vi.mocked(store.readContent).mockResolvedValue(new Uint8Array([1, 2, 3]) as never)
    await expect(readAddonFile('k')).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('id addonu', () => {
  it('pierwsza wersja przypina id do projektu', async () => {
    await claimAddonId({ id: 'p1', meta: {} }, 'better-stats')
    const [sql, params] = vi.mocked(db.exec).mock.calls[0]!
    expect(sql).toContain(`jsonb_build_object('addonId'`)
    expect(params).toEqual(['p1', 'better-stats'])
  })

  it('kolejna wersja nie moze zmienic id', async () => {
    await expect(claimAddonId({ id: 'p1', meta: { addonId: 'better-stats' } }, 'other'))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(db.exec).not.toHaveBeenCalled()
  })

  it('ta sama wersja id przechodzi bez zapisu', async () => {
    await claimAddonId({ id: 'p1', meta: { addonId: 'better-stats' } }, 'better-stats')
    expect(db.exec).not.toHaveBeenCalled()
  })

  it('id zajete przez inny projekt to 409', async () => {
    vi.mocked(db.exec).mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }) as never)
    await expect(claimAddonId({ id: 'p2', meta: {} }, 'better-stats'))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('baza sama pilnuje, ze id jest jedno', () => {
    const schema = readFileSync('server/utils/schema-catalog.ts', 'utf8')
    expect(schema).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uniq_addon_id ON project \(\(meta->>'addonId'\)\)/)
  })
})

describe('trasy wersji', () => {
  const author = readFileSync('server/api/catalog/project/[slug]/versions.post.ts', 'utf8')
  const admin = readFileSync('server/api/admin/catalog/projects/[id]/versions.post.ts', 'utf8')

  it('autor: manifest jest czytany i przypiety, zanim powstanie wiersz wersji', () => {
    const read = author.indexOf('readAddonFile(')
    const claim = author.indexOf('claimAddonId(')
    const apply = author.indexOf('addonVersionInput(manifest)')
    const create = author.indexOf('createVersion(')

    expect(read).toBeGreaterThan(0)
    expect(read).toBeLessThan(claim)
    expect(claim).toBeLessThan(apply)
    expect(apply).toBeLessThan(create)
  })

  it('panel admina nie tworzy wersji addonu bez pliku', () => {
    expect(admin).toContain(`project.type === 'addon'`)
    expect(admin.indexOf(`project.type === 'addon'`)).toBeLessThan(admin.indexOf('createVersion('))
  })
})
