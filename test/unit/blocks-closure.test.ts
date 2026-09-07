import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// Blocking that changes neither what is visible nor what is possible is just a
// list. These pin that it is wired where it has to act.
describe('blokowanie dziala, a nie tylko istnieje', () => {
  it('komentarze zablokowanych znikaja czytajacemu', () => {
    const route = readFileSync('server/api/catalog/project/[slug]/comments.get.ts', 'utf8')
    const module = readFileSync('server/utils/project-thread.ts', 'utf8')

    expect(route).toContain('blockedIds(viewer.id)')
    expect(module).toContain('NOT (c.author_id = ANY($3))')
  })

  it('nie da sie odpisac zablokowanej osobie', () => {
    const route = readFileSync('server/api/catalog/project/[slug]/comments.post.ts', 'utf8')
    expect(route).toContain('eitherBlocked(user.id, parent.author_id)')
  })

  it('zaproszenie do znajomych nie przechodzi przez blokade', () => {
    const route = readFileSync('server/api/friends.post.ts', 'utf8')
    expect(route).toContain('eitherBlocked(me.id, target.id)')
  })

  const module = readFileSync('server/utils/blocks.ts', 'utf8')

  // The blocked person is never told, because telling them turns a quiet exit
  // into an argument.
  it('blokada odpowiada tak samo jak brak konta', () => {
    const route = readFileSync('server/api/friends.post.ts', 'utf8')
    expect(route).toContain(`statusMessage: 'no such user'`)
  })

  it('blokada zrywa istniejaca znajomosc', () => {
    expect(module).toContain('DELETE FROM friendship')
  })

  it('dziala w obie strony przy odmowie interakcji', () => {
    expect(module).toContain('(user_id = $1 AND blocked_id = $2) OR (user_id = $2 AND blocked_id = $1)')
  })

  it('nie da sie zablokowac samego siebie', () => {
    expect(module).toContain('you cannot block yourself')
  })
})

describe('zamkniecie konta', () => {
  const module = readFileSync('server/utils/account-closure.ts', 'utf8')
  const route = readFileSync('server/api/me/close.post.ts', 'utf8')

  // An action with no undo needs a confirmation nobody clicks through by reflex.
  it('wymaga przepisania nazwy uzytkownika', () => {
    expect(route).toContain('type your username to confirm')
  })

  it('token nie moze zamknac konta', () => {
    expect(route).toContain('tokens cannot close an account')
  })

  it('jedyny wlasciciel organizacji nie znika po cichu', () => {
    expect(module).toContain('sole_owner')
    expect(module).toContain(`role = 'owner'`)
  })

  // Money already taken has to stay attributable. The blocker went out with the
  // old purchase table and comes back with the order model — left pending rather
  // than deleted, so the gap stays visible in every test run.
  it.todo('sprzedaz blokuje zamkniecie')

  it('historia moderacji zostaje, autor jest odpinany', () => {
    expect(module).toContain('UPDATE project_message SET author_id = NULL')
    expect(module).toContain('UPDATE report SET reporter_id = NULL')
  })

  it('mozna zobaczyc skutki przed wykonaniem', () => {
    const preview = readFileSync('server/api/me/close.get.ts', 'utf8')
    expect(preview).toContain('closureBlockers')
    expect(preview).toContain('accountFootprint')
  })
})

describe('obrazy wiedza, do czego naleza', () => {
  const module = readFileSync('server/utils/images.ts', 'utf8')

  it('sprzatanie kasuje najpierw obiekt, potem wiersz', () => {
    const bucket = module.indexOf('r2Delete(r2, row.object_key)')
    const row = module.indexOf('forgetImage(row.object_key)')
    expect(bucket).toBeGreaterThan(-1)
    expect(bucket).toBeLessThan(row)
  })

  it('ikona i galeria zapisuja kontekst', () => {
    for (const file of [
      'server/api/admin/catalog/projects/[id]/icon.post.ts',
      'server/api/admin/catalog/projects/[id]/gallery.post.ts',
    ]) {
      expect(readFileSync(file, 'utf8'), file).toContain(`context: 'project'`)
    }
  })

  it('logo organizacji i awatar tez', () => {
    expect(readFileSync('server/api/org/[slug]/logo.post.ts', 'utf8')).toContain(`context: 'organization'`)
    expect(readFileSync('server/api/me/avatar.post.ts', 'utf8')).toContain(`context: 'user'`)
  })

  // A delete loop nobody asked for is how a bad query empties a bucket.
  it('sprzatanie jest uruchamiane recznie, nie z zegara', () => {
    const route = readFileSync('server/api/admin/catalog/images.post.ts', 'utf8')
    expect(route).toContain('requireCatalogWrite(event)')
    expect(route).toContain('queueSweep()')
  })
})
