import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  ALL_PROJECT_PERMISSIONS,
  ORG_INHERITED_PROJECT_PERMISSIONS,
  PROJECT_PERMISSIONS,
  PROJECT_PERMISSION_KEYS,
  canGrantProject,
  hasProjectPermission,
  projectListToMask,
  projectMaskToList,
} from '../../shared/utils/project-permissions'

describe('rejestr uprawnien projektu', () => {
  it('kazde to inna potega dwojki', () => {
    const bits = PROJECT_PERMISSION_KEYS.map(key => PROJECT_PERMISSIONS[key])
    expect(new Set(bits).size).toBe(bits.length)
    for (const bit of bits) expect(Number.isInteger(Math.log2(bit))).toBe(true)
  })

  it('maska i lista sa odwracalne', () => {
    expect(projectMaskToList(ALL_PROJECT_PERMISSIONS).sort())
      .toEqual([...PROJECT_PERMISSION_KEYS].sort())
    expect(projectListToMask(PROJECT_PERMISSION_KEYS)).toBe(ALL_PROJECT_PERMISSIONS)
    expect(projectListToMask(['edit_body', 'nieistniejace'])).toBe(PROJECT_PERMISSIONS.edit_body)
  })

  it('nie nadasz tego, czego sam nie masz', () => {
    const actor = PROJECT_PERMISSIONS.edit_body | PROJECT_PERMISSIONS.upload_version
    expect(canGrantProject(actor, PROJECT_PERMISSIONS.edit_body)).toBe(true)
    expect(canGrantProject(actor, PROJECT_PERMISSIONS.delete_project)).toBe(false)
  })
})

// Being in an organization is for working on a project, not for deleting it or
// seeing money that belongs to someone else.
describe('co daje sama przynaleznosc do organizacji', () => {
  it('pozwala pracowac nad projektem', () => {
    for (const key of ['upload_version', 'edit_details', 'edit_body', 'view_analytics'] as const) {
      expect(hasProjectPermission(ORG_INHERITED_PROJECT_PERMISSIONS, key), key).toBe(true)
    }
  })

  it('nie pozwala kasowac, zarzadzac ludzmi ani widziec wyplat', () => {
    for (const key of ['delete_project', 'edit_member', 'remove_member', 'view_payouts'] as const) {
      expect(hasProjectPermission(ORG_INHERITED_PROJECT_PERMISSIONS, key), key).toBe(false)
    }
  })

  it('to podzbior pelnych uprawnien', () => {
    expect(ORG_INHERITED_PROJECT_PERMISSIONS & ~ALL_PROJECT_PERMISSIONS).toBe(0)
    expect(ORG_INHERITED_PROJECT_PERMISSIONS).not.toBe(ALL_PROJECT_PERMISSIONS)
  })
})

describe('skad biora sie prawa', () => {
  const source = readFileSync('server/utils/project-rights.ts', 'utf8')

  it('wlasciciel i administrator strony maja wszystko', () => {
    expect(source).toContain('if (isAdmin(user))')
    expect(source).toContain('project.owner_id === user.id')
  })

  it('prawa nadane wprost sumuja sie z tymi z organizacji', () => {
    expect(source).toContain('mask |= standing.role')
  })

  // Deleting a project follows from the organization right to remove projects,
  // rather than being granted a second time.
  it('usuwanie projektow w organizacji daje kasowanie projektu', () => {
    expect(source).toContain('PROJECT_PERMISSIONS.delete_project')
    expect(source).not.toContain('ALL_PROJECT_PERMISSIONS & ~0')
  })

  // Somebody with no rights must not learn that the project exists.
  it('brak praw daje 404, brak jednego prawa daje 403', () => {
    expect(source).toContain('if (!standing.mask)')
    expect(source).toContain('statusCode: 404')
    expect(source).toContain('statusCode: 403')
  })

  it('niezalogowany nie ma nic', () => {
    expect(source).toContain('if (!user) return { mask: 0')
  })
})
