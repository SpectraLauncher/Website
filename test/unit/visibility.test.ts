import { describe, expect, it } from 'vitest'

import {
  LINKABLE_STATUSES,
  LISTED_STATUSES,
  SUBMITTABLE_STATUSES,
  VISIBILITIES,
  applyVisibility,
  initialStatus,
  needsReview,
  visibilityOf,
} from '../../shared/utils/catalog-types'

describe('nowy projekt', () => {
  it('publiczny i niepubliczny zaczynaja jako szkic', () => {
    expect(initialStatus('public')).toBe('draft')
    expect(initialStatus('unlisted')).toBe('draft')
  })

  it('prywatny jest od razu na miejscu', () => {
    expect(initialStatus('private')).toBe('private')
    expect(needsReview('private')).toBe(false)
  })

  it('wszystko poza prywatnym idzie do sprawdzenia', () => {
    expect(needsReview('public')).toBe(true)
    expect(needsReview('unlisted')).toBe(true)
  })
})

describe('zmiana widocznosci', () => {
  // The whole reason status and requested_status are two columns: what the
  // author wants is not where the project is until somebody agrees.
  it('szkic zapamietuje wybor, ale zostaje szkicem', () => {
    expect(applyVisibility('draft', 'published', 'unlisted'))
      .toEqual({ status: 'draft', requested: 'unlisted' })
  })

  it('zaakceptowany projekt sam przechodzi miedzy publicznym a niepublicznym', () => {
    expect(applyVisibility('published', 'published', 'unlisted'))
      .toEqual({ status: 'unlisted', requested: 'unlisted' })
    expect(applyVisibility('unlisted', 'unlisted', 'public'))
      .toEqual({ status: 'published', requested: 'published' })
  })

  it('ukrycie dziala natychmiast z kazdego stanu', () => {
    for (const status of ['draft', 'pending', 'published', 'unlisted', 'rejected']) {
      expect(applyVisibility(status, 'published', 'private').status, status).toBe('private')
    }
  })

  it('wyjscie z prywatnego wraca do kolejki, a nie od razu na strone', () => {
    expect(applyVisibility('private', 'published', 'public'))
      .toEqual({ status: 'draft', requested: 'published' })
  })

  it('odrzucony projekt po zmianie dalej musi zostac wyslany', () => {
    expect(applyVisibility('rejected', 'published', 'public').status).toBe('draft')
  })

  // Editing a form is not a way out of a moderator's decision.
  it('nie wyciaga projektu z kolejki ani z usuniecia', () => {
    expect(applyVisibility('pending', 'published', 'public').status).toBe('pending')
    expect(applyVisibility('removed', 'published', 'public').status).toBe('removed')
    expect(applyVisibility('archived', 'published', 'public').status).toBe('archived')
  })

  it('ukrycie nie gubi tego, o co autor prosil', () => {
    expect(applyVisibility('draft', 'unlisted', 'private').requested).toBe('unlisted')
  })
})

describe('odczyt widocznosci', () => {
  it('kazdy stan daje sie nazwac', () => {
    expect(visibilityOf('private', 'published')).toBe('private')
    expect(visibilityOf('unlisted', 'published')).toBe('unlisted')
    expect(visibilityOf('published', 'unlisted')).toBe('public')
    expect(visibilityOf('archived', 'published')).toBe('public')
    expect(visibilityOf('draft', 'unlisted')).toBe('unlisted')
    expect(visibilityOf('pending', 'published')).toBe('public')
    expect(visibilityOf('rejected', 'nonsense')).toBe('public')
  })

  it('wraca do tego, co bylo ustawione', () => {
    for (const visibility of VISIBILITIES) {
      const status = initialStatus(visibility)
      const requested = visibility === 'private' ? 'published' : visibility === 'unlisted' ? 'unlisted' : 'published'
      expect(visibilityOf(status, requested), visibility).toBe(visibility)
    }
  })
})

// The reason private exists at all: it must never reach anybody else, and a
// status that is neither listed nor linkable is what enforces that.
describe('prywatny nie wycieka', () => {
  it('nie jest ani listowany, ani osiagalny z linku', () => {
    expect(LISTED_STATUSES).not.toContain('private')
    expect(LINKABLE_STATUSES).not.toContain('private')
  })

  it('nie da sie go wyslac do moderacji', () => {
    expect(SUBMITTABLE_STATUSES).not.toContain('private')
  })
})
