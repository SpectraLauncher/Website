import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  LINKABLE_STATUSES,
  LISTED_STATUSES,
  PROJECT_STATUSES,
  QUEUED_STATUSES,
  SUBMITTABLE_STATUSES,
  isLinkable,
  isListed,
  isQueued,
  isSubmittable,
} from '../../server/utils/catalog-types'

describe('status oczekujacy', () => {
  it('istnieje i jest odrebny od szkicu', () => {
    expect(PROJECT_STATUSES).toContain('pending')
    expect(PROJECT_STATUSES).toContain('draft')
  })

  // Zgloszenie do moderacji nie jest publikacja. Gdyby 'pending' wpadlo do
  // ktorejkolwiek z tych list, projekt bylby widoczny zanim ktokolwiek go
  // obejrzal — czyli moderacja nie mialaby sensu.
  it('nie jest ani listowany, ani otwieralny z linku', () => {
    expect(LISTED_STATUSES).not.toContain('pending')
    expect(LINKABLE_STATUSES).not.toContain('pending')
    expect(isListed('pending')).toBe(false)
    expect(isLinkable('pending')).toBe(false)
  })

  it('to jedyny status w kolejce', () => {
    expect([...QUEUED_STATUSES]).toEqual(['pending'])
    expect(isQueued('pending')).toBe(true)
    for (const status of PROJECT_STATUSES.filter(s => s !== 'pending')) {
      expect(isQueued(status), status).toBe(false)
    }
  })
})

describe('co wolno zglosic', () => {
  it('szkic i odrzucony wracaja do kolejki', () => {
    expect(isSubmittable('draft')).toBe(true)
    expect(isSubmittable('rejected')).toBe(true)
  })

  // Usuniety nie wraca sam z siebie, a juz opublikowany i oczekujacy nie maja po
  // co — drugie zgloszenie tego samego projektu zdublowaloby wpis w kolejce.
  it('reszta nie', () => {
    for (const status of ['pending', 'published', 'unlisted', 'archived', 'removed']) {
      expect(isSubmittable(status), status).toBe(false)
    }
  })

  it('kazdy zglaszalny status jest prawdziwym statusem', () => {
    for (const status of SUBMITTABLE_STATUSES) expect(PROJECT_STATUSES).toContain(status)
  })
})

describe('odwolanie wraca do kolejki', () => {
  const source = readFileSync('server/api/catalog/project/[slug]/thread.post.ts', 'utf8')

  // Odwolanie, ktore nie zmienia statusu, jest wiadomoscia, ktorej nikt nie ma
  // zaplanowanej do przeczytania — autor poprawia projekt i czeka w prozni.
  it('odpowiedz autora na odrzucenie ustawia pending', () => {
    expect(source).toContain(`project.status === 'rejected'`)
    expect(source).toContain(`updateProject(project.id, { status: 'pending' })`)
  })

  it('odpowiedz moderatora nie przestawia statusu', () => {
    expect(source).toContain('!staff && ')
  })
})

describe('kolejka nie omija straznika', () => {
  it('endpoint kolejki wymaga uprawnien do zapisu w katalogu', () => {
    const source = readFileSync('server/api/admin/catalog/queue.get.ts', 'utf8')
    expect(source).toContain('requireCatalogWrite(event)')
  })

  it('zgloszenie wymaga zalogowania i dostepu do projektu', () => {
    const source = readFileSync('server/api/catalog/project/[slug]/submit.post.ts', 'utf8')
    expect(source).toContain('requireUser(event)')
    expect(source).toContain('canSeeThread(project, user)')
  })
})
