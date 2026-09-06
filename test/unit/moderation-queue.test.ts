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

  // Submitting is not publishing. If 'pending' reached either list the project
  // would be visible before anyone looked at it, which is the whole point.
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

  // A removed project does not requeue itself, and one already published or
  // waiting has no reason to: a second submission would duplicate the queue entry.
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

  // An appeal that changes no status is a message nobody is scheduled to read:
  // the author fixes the project and waits in a vacuum.
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
