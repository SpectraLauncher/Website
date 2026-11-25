import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { pushRefusal, shareRole, updateAudience } from '../../server/utils/share'

const now = 1_800_000_000_000
const live = { revision: 4, uploaded: true, pending_by: null, pending_at: null }

describe('kto moze wypychac', () => {
  it('wlasciciel zawsze, odbiorca tylko z can_push', () => {
    expect(shareRole('owner', 'owner', null)).toBe('owner')
    expect(shareRole('owner', 'friend', true)).toBe('collaborator')
    expect(shareRole('owner', 'friend', false)).toBeNull()
    expect(shareRole('owner', 'stranger', null)).toBeNull()
  })

  // Revoking is just can_push going back to false; the next push is refused.
  it('odebranie uprawnien zamyka droge', () => {
    expect(shareRole('owner', 'friend', true)).toBe('collaborator')
    expect(shareRole('owner', 'friend', false)).toBeNull()
  })

  it('kod bez wlasciciela nie daje nikomu roli', () => {
    expect(shareRole(null, 'friend', false)).toBeNull()
  })
})

describe('konflikt rewizji', () => {
  it('wypchniecie z biezacej rewizji przechodzi', () => {
    expect(pushRefusal(live, { role: 'collaborator', userId: 'a', base: 4, now })).toBeNull()
  })

  it('nieaktualna rewizja jest odrzucana z numerem najnowszej', () => {
    const refusal = pushRefusal(live, { role: 'collaborator', userId: 'a', base: 3, now })
    expect(refusal).toMatchObject({ statusCode: 409, data: { reason: 'stale', revision: 4 } })
    expect(pushRefusal(live, { role: 'owner', userId: 'o', base: 3, now })?.data.reason).toBe('stale')
  })

  it('bez bazy wypycha tylko wlasciciel (stary launcher)', () => {
    expect(pushRefusal(live, { role: 'owner', userId: 'o', base: null, now })).toBeNull()
    expect(pushRefusal(live, { role: 'collaborator', userId: 'a', base: null, now })?.statusCode).toBe(400)
  })

  it('cudzy trwajacy upload blokuje, wlasny i porzucony nie', () => {
    const busy = { ...live, pending_by: 'b', pending_at: String(now - 60_000) }
    expect(pushRefusal(busy, { role: 'collaborator', userId: 'a', base: 4, now })?.data.reason).toBe('busy')
    expect(pushRefusal(busy, { role: 'collaborator', userId: 'b', base: 4, now })).toBeNull()

    const abandoned = { ...busy, pending_at: now - 3 * 60 * 60 * 1000 }
    expect(pushRefusal(abandoned, { role: 'collaborator', userId: 'a', base: 4, now })).toBeNull()
  })

  it('pierwszy, jeszcze nieukonczony upload nie ma rewizji do porownania', () => {
    const fresh = { revision: 1, uploaded: false, pending_by: null, pending_at: null }
    expect(pushRefusal(fresh, { role: 'owner', userId: 'o', base: 0, now })).toBeNull()
  })
})

describe('kto dostaje aktualizacje', () => {
  it('wszyscy posiadacze i wlasciciel, bez wypychajacego', () => {
    expect(updateAudience('owner', ['a', 'b'], 'a').sort()).toEqual(['b', 'owner'])
    expect(updateAudience('owner', ['a', 'b'], 'owner').sort()).toEqual(['a', 'b'])
  })
})

describe('trasy udostepniania', () => {
  const read = (p: string) => readFileSync(`server/api/${p}`, 'utf8')

  it('upload i zakonczenie sprawdzaja role i konflikt', () => {
    const ticket = read('share/upload-url.post.ts')
    expect(ticket).toContain('pushRefusal(existing')
    expect(ticket).toContain('shareRole(existing.owner_id')
    // The claim is repeated inside the UPDATE so two tickets cannot race.
    expect(ticket).toMatch(/WHERE code = \$7 AND \(pending_by IS NULL/)

    const complete = read('share/[code]/complete.post.ts')
    expect(complete).toContain('shareRole(row.owner_id, me.id, row.can_push)')
    expect(complete).toContain('(row.pending_by ?? row.owner_id) !== me.id')
    expect(complete).toContain('updateAudience(row.owner_id')
  })

  it('prawo wypychania nadaje i odbiera tylko wlasciciel', () => {
    const patch = read('share/[code]/invite.patch.ts')
    expect(patch).toContain('share?.owner_id !== me.id')
    expect(patch).toContain('statusCode: 404')

    const invite = read('share/[code]/invite.post.ts')
    expect(invite).toContain(`const grant = role === 'owner' && canPush === true`)
    expect(invite).toContain('areFriends(me.id, userId)')
  })

  it('lista nie oddaje wspolpracownikowi cudzego instance_id', () => {
    expect(read('shares.get.ts')).toContain(`instance_id: role === 'owner' ? s.instance_id : null`)
  })
})
