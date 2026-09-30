import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ exec: vi.fn(), one: vi.fn(), q: vi.fn(), usePool: vi.fn() }))
vi.mock('../../server/utils/organization', () => ({ orgStanding: vi.fn() }))

const db = await import('../../server/utils/db')
const organization = await import('../../server/utils/organization')
const { permissionsOf, rankOf } = await import('../../shared/utils/org-permissions')
const { projectStanding } = await import('../../server/utils/project-rights')
const {
  ALL_PROJECT_PERMISSIONS,
  ORG_INHERITED_PROJECT_PERMISSIONS,
  ORG_MANAGER_PROJECT_PERMISSIONS,
  hasProjectPermission,
} = await import('../../shared/utils/project-permissions')

const project = { id: 'p1', owner_id: null, org_id: 'o1' } as never
const user = { id: 'u1', role: null }

const inOrg = (role: string, permissions: number | null = null) => {
  vi.mocked(organization.orgStanding).mockResolvedValue({
    role,
    mask: permissionsOf(role, permissions),
    rank: rankOf(role),
    siteAdmin: false,
  } as never)
}

beforeEach(() => {
  vi.mocked(db.one).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(organization.orgStanding).mockReset()
})

describe('prawa do projektow organizacji wedlug roli', () => {
  it('czlonek dostaje zestaw roboczy', async () => {
    inOrg('member')
    expect((await projectStanding(project, user)).mask).toBe(ORG_INHERITED_PROJECT_PERMISSIONS)
  })

  it('moderator zarzadza kazdym projektem organizacji i moze go usunac', async () => {
    inOrg('moderator')
    const { mask } = await projectStanding(project, user)
    expect(mask).toBe(ALL_PROJECT_PERMISSIONS)
    expect(hasProjectPermission(mask, 'manage_invites')).toBe(true)
  })

  it('usuwanie idzie za bitem organizacji, nie za sama rola', async () => {
    inOrg('moderator', 1 << 4)
    const { mask } = await projectStanding(project, user)
    expect(mask).toBe(ORG_MANAGER_PROJECT_PERMISSIONS)
    expect(hasProjectPermission(mask, 'delete_project')).toBe(false)
  })

  it('admin organizacji jak moderator', async () => {
    inOrg('admin')
    expect((await projectStanding(project, user)).mask).toBe(ALL_PROJECT_PERMISSIONS)
  })

  it('wlasciciel ma wszystko', async () => {
    inOrg('owner', 0)
    expect((await projectStanding(project, user)).mask).toBe(ALL_PROJECT_PERMISSIONS)
  })
})

describe('moderator organizacji poza prawami', () => {
  it('mozna go zaprosic', () => {
    expect(readFileSync('server/api/org/[slug]/invite.post.ts', 'utf8')).toContain("body.role === 'moderator'")
  })

  it('better-auth zna te role, inaczej odrzuci zaproszenie', () => {
    const auth = readFileSync('server/utils/auth.ts', 'utf8')
    expect(auth).toContain('roles: { ...defaultRoles, moderator: memberAc }')
  })

  it('dostaje powiadomienia o projektach organizacji', () => {
    expect(readFileSync('server/utils/project-notify.ts', 'utf8')).toContain('rankOf(m.role) >= ORG_ROLE_RANK.moderator')
  })
})
