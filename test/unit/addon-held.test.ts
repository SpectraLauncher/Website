import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ exec: vi.fn(), one: vi.fn(), q: vi.fn(), usePool: vi.fn() }))

const db = await import('../../server/utils/db')
const catalog = await import('../../server/utils/catalog')
const { versionsByHash } = await import('../../server/utils/catalog-hash')
const { newAddonAsks } = await import('../../shared/utils/addon-install')

const read = (file: string) => readFileSync(file, 'utf8')

beforeEach(() => {
  vi.mocked(db.q).mockReset().mockResolvedValue([] as never)
  vi.mocked(db.one).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(db.exec).mockReset().mockResolvedValue(1 as never)
})

describe('co w nowej wersji addonu wymaga przegladu', () => {
  const approved = [
    { permissions: ['instances:read', 'network:api.example.com'] },
    { permissions: ['logs:read'] },
  ]

  it('to samo albo mniej przechodzi od razu', () => {
    expect(newAddonAsks(approved, { permissions: ['instances:read', 'logs:read'] })).toEqual([])
    expect(newAddonAsks(approved, { permissions: [] })).toEqual([])
    expect(newAddonAsks(approved, {})).toEqual([])
  })

  it('nowe uprawnienie i nowy host czekaja', () => {
    expect(newAddonAsks(approved, { permissions: ['instances:read', 'instances:write'] })).toEqual(['instances:write'])
    expect(newAddonAsks(approved, { permissions: ['network:evil.example'] })).toEqual(['network:evil.example'])
  })

  it('pierwszy backend.wasm czeka, kolejny juz nie', () => {
    expect(newAddonAsks(approved, { backend: 'backend.wasm' })).toEqual(['backend'])
    expect(newAddonAsks([{ backend: 'backend.wasm' }], { backend: 'backend.wasm' })).toEqual([])
  })

  it('smieci w meta nie wywracaja porownania', () => {
    expect(newAddonAsks([null, { permissions: 'instances:read' }], { permissions: [1, 'logs:read'] })).toEqual(['logs:read'])
  })
})

describe('wersja czekajaca na przeglad nigdzie nie wycieka', () => {
  it('lista wersji domyslnie jej nie zwraca', async () => {
    await catalog.versionsOf('p1')
    const [sql, params] = vi.mocked(db.q).mock.calls[0]!
    expect(sql).toContain('($2 OR NOT held)')
    expect(params).toEqual(['p1', false])
  })

  it('pojedyncza wersja tez nie', async () => {
    await catalog.versionById('v1')
    expect(vi.mocked(db.one).mock.calls[0]![1]).toEqual(['v1', false])
  })

  it('wyszukiwanie po hashu jej nie zna', async () => {
    await versionsByHash(['a'.repeat(128)], 'sha512')
    expect(vi.mocked(db.q).mock.calls[0]![0]).toContain('AND NOT v.held')
  })

  it('wersje i loadery projektu licza sie bez niej', async () => {
    await catalog.refreshProjectFacets('p1')
    expect(String(vi.mocked(db.exec).mock.calls[0]![0]).match(/NOT v\.held/g)).toHaveLength(2)
  })

  it('pobranie wymaga praw do projektu albo moderacji', () => {
    const source = read('server/api/catalog/download/[fileId].get.ts')
    expect(source).toContain('found.version.held')
    expect(source).toContain("mayProject(found.project, viewer, 'upload_version')")
  })

  it('profil, zaleznosci i publiczne trasy jej nie pokazuja', () => {
    expect(read('server/utils/profile-feed.ts')).toContain('AND NOT v.held')
    expect(read('server/utils/dependencies.ts')).toContain('AND NOT v.held')
    for (const file of [
      'server/api/catalog/project/[slug].get.ts',
      'server/api/catalog/project/[slug]/versions.get.ts',
      'server/api/v2/project/[id].get.ts',
      'server/api/v2/project/[id]/version.get.ts',
      'server/api/v2/projects.get.ts',
      'server/api/v2/version/[id].get.ts',
    ]) {
      expect(read(file), file).not.toMatch(/versions?(Of|ById)\([^)]*, true\)/)
    }
  })

  it('autor i panel ja widza', () => {
    expect(read('server/api/catalog/project/[slug]/editor.get.ts')).toContain('versionsOf(project.id, true)')
    expect(read('server/api/admin/catalog/projects/[id].get.ts')).toContain('versionsOf(project.id, true)')
  })
})

describe('kiedy wersja trafia do przegladu', () => {
  const route = read('server/api/catalog/project/[slug]/versions.post.ts')

  it('tylko addon, tylko po akceptacji projektu i tylko gdy prosi o cos nowego', () => {
    expect(route).toContain("project.type === 'addon'")
    expect(route).toContain('project.approved !== null')
    expect(route).toContain('newAddonAsks(')
    expect(route).toContain('createVersion(project.id, body, held)')
  })

  it('obserwujacy nie dostaja powiadomienia o wersji, ktorej nie widac', () => {
    expect(route).toMatch(/if \(held\)[^\n]*notifyStaff[\s\S]*else await notifyFollowers/)
  })

  it('autor nie zmieni metadanych addonu po fakcie', () => {
    const patch = read('server/api/catalog/project/[slug]/versions/[version].patch.ts')
    expect(patch).toContain('delete body.meta')
  })

  it('moderator zatwierdza tylko z lista kontrolna', () => {
    const review = read('server/api/admin/catalog/versions/[id]/review.post.ts')
    expect(review.indexOf('requireModeration(event)')).toBeLessThan(review.indexOf('versionById('))
    expect(review.indexOf('addonReviewDone(body.review)')).toBeLessThan(review.indexOf('releaseVersion('))
  })
})
