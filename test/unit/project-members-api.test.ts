import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const base = 'server/api/catalog/project/[slug]'

describe('czlonkowie projektu', () => {
  const list = readFileSync(`${base}/members.get.ts`, 'utf8')
  const write = readFileSync(`${base}/members.post.ts`, 'utf8')
  const remove = readFileSync(`${base}/members/[userId].delete.ts`, 'utf8')

  it('kazda trasa przechodzi przez straznika katalogu', () => {
    for (const [name, source] of [['get', list], ['post', write], ['delete', remove]] as const) {
      expect(source, name).toContain('requireCatalogRead(event)')
    }
  })

  // Somebody with no rights on the project must not learn that it exists.
  it('brak jakichkolwiek praw daje 404, nie pusta liste', () => {
    expect(list).toContain('if (!standing.mask)')
    expect(list).toContain('statusCode: 404')
  })

  it('zmiana i usuniecie wymagaja wlasciwego uprawnienia', () => {
    expect(write).toContain(`requireProjectPermission(project, user, 'edit_member')`)
    expect(remove).toContain(`requireProjectPermission(project, user, 'remove_member')`)
  })

  // The same rule the organization uses, checked against the actor's own mask
  // rather than against their role.
  it('nie da sie nadac uprawnienia, ktorego sie nie ma', () => {
    expect(write).toContain('canGrantProject(standing.mask, wanted)')
  })

  it('wlasciciela nie da sie ani dodac, ani usunac', () => {
    expect(write).toContain('target.id === project.owner_id')
    expect(remove).toContain('userId === project.owner_id')
  })

  // The panel must not offer a control the server will refuse.
  it('interfejs dostaje wlasna maske, zeby wyszarzyc reszte', () => {
    expect(list).toContain('projectMaskToList(standing.mask)')

    const ui = readFileSync('app/components/ProjectMembers.vue', 'utf8')
    expect(ui).toContain(':disabled="!may(key)"')
  })
})

describe('moje zgloszenia', () => {
  const page = readFileSync('app/pages/reports.vue', 'utf8')

  it('strona jest za flaga katalogu i poza indeksem', () => {
    expect(page).toContain(`middleware: 'catalog'`)
    expect(page).toContain(`robots: 'noindex'`)
  })

  it('czyta wlasne zgloszenia i watek przy nich', () => {
    expect(page).toContain(`'/api/catalog/reports'`)
    expect(page).toContain('/thread')
  })

  it('tresc od ludzi lamie dlugie slowa', () => {
    const matches = page.match(/whitespace-pre-wrap break-words/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })
})
