import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ usePool: vi.fn(), exec: vi.fn(), one: vi.fn(), q: vi.fn() }))

const { auditEntry } = await import('../../server/utils/audit')

const read = (file: string) => readFileSync(file, 'utf8')
const slash = (file: string) => file.split(sep).join('/')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory()
    ? walk(join(dir, entry.name))
    : [join(dir, entry.name)]))
}

describe('wpis dziennika', () => {
  it('nie gubi pol i normalizuje czas', () => {
    const entry = auditEntry({
      id: 'a1',
      actor_id: 'u1',
      actor_name: 'makotopd',
      action: 'project.approve',
      subject_kind: 'project',
      subject_id: 'p1',
      summary: 'Terralith → published',
      meta: { slug: 'terralith' },
      source: 'panel',
      // the driver hands bigints back as strings
      created: '1757600000000',
    })

    expect(entry.created).toBe(1757600000000)
    expect(entry.actor).toBe('makotopd')
    expect(entry.meta).toEqual({ slug: 'terralith' })
  })

  it('brak meta to pusty obiekt, nie null', () => {
    const entry = auditEntry({
      id: 'a2', actor_id: null, actor_name: '', action: 'user.ban',
      subject_kind: 'user', subject_id: 'u9', summary: '', meta: null,
      source: 'panel', created: 1,
    })

    expect(entry.meta).toEqual({})
    expect(entry.actorId).toBeNull()
  })
})

// The log is only worth having if the decisions that matter reach it. These are
// the endpoints where a moderator changes somebody else's standing.
describe('co trafia do dziennika', () => {
  const LOGGED = [
    'server/api/admin/catalog/projects/[id]/moderate.post.ts',
    'server/api/admin/catalog/reports/[id].patch.ts',
    'server/api/admin/users/[id].patch.ts',
    'server/api/admin/users/[id].delete.ts',
    'server/api/admin/verification/[id].post.ts',
    'server/api/admin/badges/award.post.ts',
    'server/api/admin/posts/[id].delete.ts',
    'server/api/admin/newsletter/[id]/send.post.ts',
  ]

  it.each(LOGGED)('%s zapisuje dzialanie', (route) => {
    expect(read(route)).toMatch(/recordStaffAction\(\{/)
  })

  it('odczyt dziennika jest za brama admina', () => {
    expect(read('server/api/admin/audit.get.ts')).toMatch(/requireAdmin\(event\)/)
    expect(read('app/pages/admin/audit.vue')).toMatch(/middleware: 'admin'/)
  })

  it('kazda trasa admina ma brame', () => {
    const open = walk('server/api/admin')
      .filter(file => file.endsWith('.ts'))
      .filter(file => !/require(Admin|CatalogWrite|CatalogRead)\(event\)/.test(read(file)))
      .map(slash)

    expect(open).toEqual([])
  })
})
