import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  ALL_ORG_PERMISSIONS,
  ORG_PERMISSIONS,
  ORG_PERMISSION_KEYS,
  ROLE_DEFAULT_PERMISSIONS,
  canGrant,
  has,
  listToMask,
  maskToList,
  permissionsOf,
  rankOf,
} from '../../shared/utils/org-permissions'

describe('bity uprawnien', () => {
  it('kazdy jest inna potega dwojki', () => {
    const bits = ORG_PERMISSION_KEYS.map(key => ORG_PERMISSIONS[key])
    expect(new Set(bits).size).toBe(bits.length)
    for (const bit of bits) expect(Number.isInteger(Math.log2(bit))).toBe(true)
  })

  it('maska i lista sa odwracalne', () => {
    expect(maskToList(ALL_ORG_PERMISSIONS).sort()).toEqual([...ORG_PERMISSION_KEYS].sort())
    expect(listToMask(ORG_PERMISSION_KEYS)).toBe(ALL_ORG_PERMISSIONS)
    expect(listToMask(['edit_details', 'nieistniejace'])).toBe(ORG_PERMISSIONS.edit_details)
    expect(listToMask('nie tablica')).toBe(0)
  })
})

describe('domyslne uprawnienia roli', () => {
  it('wlasciciel ma wszystko, czlonek nic', () => {
    expect(ROLE_DEFAULT_PERMISSIONS.owner).toBe(ALL_ORG_PERMISSIONS)
    expect(ROLE_DEFAULT_PERMISSIONS.member).toBe(0)
  })

  // Deleting stays with the owner; otherwise an invited admin could delete an
  // organization that is not theirs.
  it('admin ma wszystko oprocz kasowania organizacji', () => {
    expect(has(ROLE_DEFAULT_PERMISSIONS.admin, 'remove_member')).toBe(true)
    expect(has(ROLE_DEFAULT_PERMISSIONS.admin, 'delete_organization')).toBe(false)
  })
})

describe('permissionsOf', () => {
  it('brak zapisanej maski znaczy domyslna dla roli', () => {
    expect(permissionsOf('admin', null)).toBe(ROLE_DEFAULT_PERMISSIONS.admin)
    expect(permissionsOf('member', undefined)).toBe(0)
  })

  it('zapisana maska nadpisuje domyslna', () => {
    expect(permissionsOf('member', ORG_PERMISSIONS.edit_details))
      .toBe(ORG_PERMISSIONS.edit_details)
  })

  // An organization must not lock its own owner out.
  it('wlasciciel ma wszystko nawet z pusta maska', () => {
    expect(permissionsOf('owner', 0)).toBe(ALL_ORG_PERMISSIONS)
  })

  it('bity spoza rejestru sa obcinane', () => {
    expect(permissionsOf('member', 0xFFFFFFFF)).toBe(ALL_ORG_PERMISSIONS)
  })
})

describe('canGrant', () => {
  // You cannot hand out a right you do not hold yourself.
  it('nie da sie nadac uprawnienia, ktorego sie nie ma', () => {
    const actor = ORG_PERMISSIONS.edit_details | ORG_PERMISSIONS.manage_invites
    expect(canGrant(actor, ORG_PERMISSIONS.edit_details)).toBe(true)
    expect(canGrant(actor, actor)).toBe(true)
    expect(canGrant(actor, ORG_PERMISSIONS.remove_member)).toBe(false)
    expect(canGrant(actor, ALL_ORG_PERMISSIONS)).toBe(false)
  })

  it('pelna maska nadaje wszystko', () => {
    expect(canGrant(ALL_ORG_PERMISSIONS, ALL_ORG_PERMISSIONS)).toBe(true)
  })
})

describe('ranga', () => {
  it('rosnie od czlonka do wlasciciela', () => {
    expect(rankOf('member')).toBeLessThan(rankOf('admin'))
    expect(rankOf('admin')).toBeLessThan(rankOf('owner'))
  })

  it('nieznana rola stoi nizej niz czlonek', () => {
    expect(rankOf('cokolwiek')).toBeLessThan(rankOf('member'))
  })
})

describe('trasy czlonkow pilnuja zasad', () => {
  const patch = readFileSync('server/api/org/[slug]/members/[userId].patch.ts', 'utf8')
  const remove = readFileSync('server/api/org/[slug]/members/[userId].delete.ts', 'utf8')
  const leave = readFileSync('server/api/org/[slug]/leave.post.ts', 'utf8')

  it('rowna ranga nie rusza rownej rangi', () => {
    for (const [name, src] of [['patch', patch], ['delete', remove]] as const) {
      expect(src, name).toContain('rankOf(target.role) >= actor.rank')
    }
  })

  it('nie da sie nadac roli wyzszej niz wlasna', () => {
    expect(patch).toContain('rankOf(role) > actor.rank')
  })

  it('uprawnienia przechodza przez canGrant', () => {
    expect(patch).toContain('canGrant(actor.mask, mask)')
  })

  // An ownerless organization has nobody to hand its projects to.
  it('ostatni wlasciciel nie znika trzema roznymi drogami', () => {
    for (const [name, src] of [['patch', patch], ['delete', remove], ['leave', leave]] as const) {
      expect(src, name).toContain('ownerCount(org.id)')
    }
  })

  it('kazda trasa sprawdza wlasciwe uprawnienie', () => {
    expect(patch).toContain(`has(actor.mask, 'edit_member')`)
    expect(remove).toContain(`has(actor.mask, 'remove_member')`)
  })
})
