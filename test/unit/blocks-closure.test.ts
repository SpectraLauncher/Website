import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// Blokowanie, ktore nie zmienia tego, co widac i co da sie zrobic, jest tylko
// lista. Te testy pilnuja, ze jest wpiete tam, gdzie ma dzialac.
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

  // Zablokowana osoba nie dowiaduje sie o blokadzie, bo to zamienia ciche
  // wyjscie w awanture.
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

  // Akcja bez cofniecia potrzebuje potwierdzenia, ktorego nie da sie kliknac
  // odruchowo.
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

  // Pieniadze, ktore juz wplynely, musza dac sie przypisac do konca.
  it('sprzedaz blokuje zamkniecie', () => {
    expect(module).toContain('has_sales')
  })

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

  // Petla kasujaca, ktorej nikt nie zlecil, to sposob na wyczyszczenie kubelka
  // zlym zapytaniem.
  it('sprzatanie jest uruchamiane recznie, nie z zegara', () => {
    const route = readFileSync('server/api/admin/catalog/images.post.ts', 'utf8')
    expect(route).toContain('requireCatalogWrite(event)')
    expect(route).toContain('queueSweep()')
  })
})
