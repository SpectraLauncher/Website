import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  STAFF_ROLES,
  atLeast,
  canModerate,
  isAdmin,
  isOwner,
  isStaff,
  isStaffRole,
  staffRank,
} from '../../shared/utils/staff-roles'

const read = (file: string) => readFileSync(file, 'utf8')
const slash = (file: string) => file.split(sep).join('/')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory()
    ? walk(join(dir, entry.name))
    : [join(dir, entry.name)]))
}

describe('drabina rol', () => {
  it('kazda rola widzi to, co ponizej niej', () => {
    for (const [i, role] of STAFF_ROLES.entries()) {
      for (const below of STAFF_ROLES.slice(0, i + 1)) {
        expect(atLeast({ role }, below), `${role} >= ${below}`).toBe(true)
      }
      for (const above of STAFF_ROLES.slice(i + 1)) {
        expect(atLeast({ role }, above), `${role} < ${above}`).toBe(false)
      }
    }
  })

  it('owner jest takze adminem i moderatorem', () => {
    expect(isAdmin({ role: 'owner' })).toBe(true)
    expect(canModerate({ role: 'owner' })).toBe(true)
  })

  // The whole point of the split: a moderator decides what gets published and
  // touches nothing else.
  it('moderator nie siega po konta ani role', () => {
    expect(canModerate({ role: 'moderator' })).toBe(true)
    expect(isAdmin({ role: 'moderator' })).toBe(false)
    expect(isOwner({ role: 'moderator' })).toBe(false)
  })

  it('admin nie rozdaje rol', () => {
    expect(isOwner({ role: 'admin' })).toBe(false)
  })

  it('nieznane i podszywajace sie role nie daja nic', () => {
    for (const role of ['', 'user', 'ADMIN', 'Owner', ' owner', 'owner ', 'superadmin', 'staff']) {
      expect(isStaff({ role }), JSON.stringify(role)).toBe(false)
      expect(staffRank({ role })).toBe(0)
    }

    expect(isStaff(null)).toBe(false)
    expect(isStaff({})).toBe(false)
    expect(isStaffRole('user')).toBe(false)
    expect(isStaffRole('owner')).toBe(true)
  })
})

describe('bramy po stronie serwera', () => {
  const routes = walk('server/api/admin').filter(file => file.endsWith('.ts'))

  it('kazda trasa panelu ma brame', () => {
    const open = routes
      .filter(file => !/require(Admin|Owner|Staff|Moderation|CatalogWrite|CatalogRead)\(event\)/.test(read(file)))
      .map(slash)

    expect(open).toEqual([])
  })

  // Moderation is the only thing a moderator may reach; the rest of the panel
  // stays at admin, so widening one by accident shows up here.
  it('moderator siega dokladnie po moderacje', () => {
    const moderation = routes.filter(file => /requireModeration\(event\)/.test(read(file))).map(slash)

    expect(moderation.sort()).toEqual([
      'server/api/admin/catalog/attribution.get.ts',
      'server/api/admin/catalog/game-versions.get.ts',
      'server/api/admin/catalog/projects.get.ts',
      'server/api/admin/catalog/projects/[id].get.ts',
      'server/api/admin/catalog/projects/[id]/claim.post.ts',
      'server/api/admin/catalog/projects/[id]/moderate.post.ts',
      'server/api/admin/catalog/queue.get.ts',
      'server/api/admin/catalog/reports.get.ts',
      'server/api/admin/catalog/reports/[id].patch.ts',
      'server/api/admin/catalog/scans.get.ts',
      'server/api/admin/catalog/scans.post.ts',
      'server/api/admin/catalog/scans/[id].post.ts',
      'server/api/admin/verification/[id].post.ts',
      'server/api/admin/verification/index.get.ts',
    ])
  })

  it('rozdawanie rol jest tylko dla wlasciciela', () => {
    const source = read('server/api/admin/users/[id]/role.patch.ts')

    expect(source).toMatch(/requireOwner\(event\)/)
    // the two rules that keep the ladder from losing its top
    expect(source).toMatch(/an owner can only be stepped down by themselves/)
    expect(source).toMatch(/the last owner cannot step down/)
    expect(source).toMatch(/recordStaffAction/)
  })

  it('nikt nie rusza konta stojacego nad nim', () => {
    for (const route of ['server/api/admin/users/[id].patch.ts', 'server/api/admin/users/[id].delete.ts']) {
      expect(read(route), route).toMatch(/staffRank\(\w+\) >= staffRank\(staff\)/)
    }
  })
})

// The upgrade path, which is the part that only bites once and bites in
// production: the database already has an admin from before roles existed.
describe('pierwszy wlasciciel', () => {
  const source = readFileSync('server/utils/schema.ts', 'utf8')

  it('brama stoi na wlascicielu, nie na dowolnej roli', () => {
    // Gating on "any staff" would see the existing admin, promote nobody, and
    // leave the deployment with no owner — and only an owner appoints one.
    expect(source).toMatch(/count\(\*\)::int AS n FROM "user" WHERE role = 'owner'/)
    expect(source).not.toMatch(/role IN \('owner', 'admin', 'moderator'\)/)
  })

  it('promuje z listy adresow na wlasciciela', () => {
    expect(source).toMatch(/UPDATE "user" SET role = 'owner' WHERE lower\(email\) = ANY\(\$1\)/)
  })

  it('podpowiedz w logu nadaje wlasciciela, nie admina', () => {
    expect(source).toMatch(/SET role = 'owner' WHERE username/)
  })
})
