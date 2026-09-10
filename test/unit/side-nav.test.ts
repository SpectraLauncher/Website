import { describe, expect, it } from 'vitest'

import { groupSideNav, type SideNavItem } from '../../app/utils/sideNav'

const item = (id: string, group?: string): SideNavItem =>
  ({ id, icon: 'i-pixelarticons-home', label: id, group })

describe('grupowanie nawigacji bocznej', () => {
  it('bez grup zwraca jedna bezimienna sekcje', () => {
    const sections = groupSideNav([item('a'), item('b')])

    expect(sections).toHaveLength(1)
    expect(sections[0]!.title).toBe('')
    expect(sections[0]!.items.map(i => i.id)).toEqual(['a', 'b'])
  })

  it('skleja sasiadujace pozycje tej samej grupy', () => {
    const sections = groupSideNav([
      item('a', 'Tresc'),
      item('b', 'Tresc'),
      item('c', 'Ludzie'),
    ])

    expect(sections.map(s => s.title)).toEqual(['Tresc', 'Ludzie'])
    expect(sections[0]!.items.map(i => i.id)).toEqual(['a', 'b'])
  })

  it('nie przestawia pozycji, wiec ta sama grupa przerwana inna daje dwa bloki', () => {
    const sections = groupSideNav([
      item('a', 'Tresc'),
      item('b', 'Ludzie'),
      item('c', 'Tresc'),
    ])

    expect(sections.map(s => s.title)).toEqual(['Tresc', 'Ludzie', 'Tresc'])
    expect(sections.flatMap(s => s.items.map(i => i.id))).toEqual(['a', 'b', 'c'])
  })

  it('pusta lista daje pusty wynik', () => {
    expect(groupSideNav([])).toEqual([])
  })
})
