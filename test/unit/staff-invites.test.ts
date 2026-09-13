import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ usePool: vi.fn(), exec: vi.fn(), one: vi.fn(), q: vi.fn() }))

const { INVITABLE_ROLES, isInvitableRole, publicInvite } = await import('../../server/utils/staff-invites')
const { ALWAYS_MAILED, wantsEmail, cleanPrefs } = await import('../../shared/utils/notification-prefs')

const read = (file: string) => readFileSync(file, 'utf8')
const slash = (file: string) => file.split(sep).join('/')

describe('co da sie zaproponowac', () => {
  it('tylko moderator i admin', () => {
    expect([...INVITABLE_ROLES]).toEqual(['moderator', 'admin'])
  })

  // Stepping somebody to the top of the ladder must not happen because a phone
  // tapped "accept".
  it('wlasciciela nie da sie zaprosic', () => {
    expect(isInvitableRole('owner')).toBe(false)
    for (const value of ['user', '', null, undefined, 'OWNER', 'moderator ']) {
      expect(isInvitableRole(value), String(value)).toBe(false)
    }
    expect(isInvitableRole('moderator')).toBe(true)
    expect(isInvitableRole('admin')).toBe(true)
  })

  it('zaproszenie wychodzace na zewnatrz nie niesie id konta ani adresu', () => {
    const shown = publicInvite({
      id: 'i1', user_id: 'u1', role: 'moderator', invited_by: 'u2',
      inviter: 'makotopd', status: 'pending', created: '1', expires: '2', answered: null,
    })

    expect(Object.keys(shown).sort()).toEqual(['created', 'expires', 'id', 'inviter', 'role'])
  })
})

describe('dostarczenie zaproszenia', () => {
  it('mail idzie niezaleznie od ustawien', () => {
    // every channel switched off
    const silent = cleanPrefs({ moderation: [], projects: [], social: [] })

    expect(wantsEmail(silent, 'staff_invite')).toBe(true)
    expect(ALWAYS_MAILED).toContain('staff_invite')
  })

  it('reszta rodzajow nadal slucha ustawien', () => {
    const silent = cleanPrefs({ projects: [] })

    expect(wantsEmail(silent, 'project_approved')).toBe(false)
    expect(wantsEmail(cleanPrefs({}), 'project_approved')).toBe(true)
  })
})

describe('bramy zaproszen', () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]))

  it('zaprasza i cofa wylacznie wlasciciel', () => {
    expect(read('server/api/admin/staff/invites/index.post.ts')).toMatch(/requireOwner\(event\)/)
    expect(read('server/api/admin/staff/invites/[id].delete.ts')).toMatch(/requireOwner\(event\)/)
    // reading the list is enough for an admin to see who is waiting
    expect(read('server/api/admin/staff/invites/index.get.ts')).toMatch(/requireAdmin\(event\)/)
  })

  it('rola bierze sie z zapisanego zaproszenia, nie z zadania', () => {
    const source = read('server/utils/staff-invites.ts')

    // the row is claimed in the statement that reads it, so a replay grants nothing
    expect(source).toMatch(/UPDATE staff_invite SET status = 'accepted'[\s\S]*?WHERE user_id = \$1 AND status = 'pending' AND expires > \$2/)
    expect(source).toMatch(/isInvitableRole\(claimed\.role\)/)

    // and the endpoint never reads a role off the body
    expect(read('server/api/me/staff-invite.post.ts')).not.toMatch(/body\.role/)
  })

  it('zaden select nie nadaje juz roli z listy kont', () => {
    const panel = read('app/pages/admin/index.vue')

    expect(panel).not.toMatch(/setRole/)
    expect(panel).toMatch(/<AdminStaffInvites/)
  })

  it('kazda trasa zaproszen ma brame', () => {
    const open = walk('server/api/admin/staff')
      .filter(file => !/require(Owner|Admin)\(event\)/.test(read(file)))
      .map(slash)

    expect(open).toEqual([])
  })
})

// The thing the author notices only when the storage bill arrives.
describe('sprzatanie po artykule', () => {
  const posts = read('server/utils/posts.ts')

  it('podmieniona okladka znika z R2', () => {
    expect(posts).toMatch(/if \(current\.cover && current\.cover !== row\.cover\) await dropStoredImage\(current\.cover\)/)
  })

  it('zdjecie usuniete z tresci znika z R2', () => {
    expect(posts).toMatch(/async function dropUnusedImages/)
    expect(posts).toMatch(/if \(key && !kept\.has\(key\)\) await dropStoredImage\(url\)/)
  })

  it('skasowany wpis zabiera ze soba wszystko', () => {
    expect(posts).toMatch(/for \(const url of postImageUrls\(row\.body\)\) await dropStoredImage\(url\)/)
    expect(posts).toMatch(/if \(row\.cover\) await dropStoredImage\(row\.cover\)/)
  })
})
