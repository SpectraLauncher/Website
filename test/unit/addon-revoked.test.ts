import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ exec: vi.fn(), one: vi.fn(), q: vi.fn(), usePool: vi.fn() }))

const db = await import('../../server/utils/db')
const { revokedAddonFiles } = await import('../../server/utils/catalog-hash')

const row = (hash: string, type: string, status: string) => ({ hash, type, status })

beforeEach(() => {
  vi.mocked(db.q).mockReset()
})

describe('wycofane addony', () => {
  it('zwraca tylko pliki addonow zdjetych przez moderacje', async () => {
    vi.mocked(db.q).mockResolvedValue([
      row('a'.repeat(128), 'addon', 'removed'),
      row('b'.repeat(128), 'addon', 'published'),
      row('c'.repeat(128), 'mod', 'removed'),
      row('d'.repeat(128), 'addon', 'rejected'),
    ] as never)

    expect(await revokedAddonFiles(['a', 'b', 'c', 'd'].map(c => c.repeat(128)))).toEqual(['a'.repeat(128)])
    const [sql, params] = vi.mocked(db.q).mock.calls[0]!
    expect(sql).toContain('f.sha512')
    expect(params).toEqual([['a', 'b', 'c', 'd'].map(c => c.repeat(128))])
  })

  it('pusta lista nie pyta bazy', async () => {
    expect(await revokedAddonFiles([])).toEqual([])
    expect(db.q).not.toHaveBeenCalled()
  })
})
