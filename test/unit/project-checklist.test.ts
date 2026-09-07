import { describe, expect, it } from 'vitest'

import {
  CHECKLIST_ITEMS,
  REQUIRED,
  checklistState,
  isReadyToSubmit,
  missingRequired,
} from '../../shared/utils/project-checklist'

const complete = {
  summary: 'Dodaje kotly, ktore warza cos wiecej niz wode.',
  description: 'x'.repeat(120),
  icon: 'https://cdn.example/icon.png',
  license: 'MIT',
  categories: ['magic'],
  versions: [{ id: 'v1' }],
  links: { source: 'https://example.com' },
  disclosures: {},
  gallery: [{ id: 'g1' }],
}

describe('checklistState', () => {
  it('kompletny projekt ma wszystko odhaczone', () => {
    const state = checklistState(complete)
    for (const item of CHECKLIST_ITEMS) expect(state[item], item).toBe(true)
  })

  it('pusty projekt nie ma nic', () => {
    const state = checklistState({})
    for (const item of CHECKLIST_ITEMS) expect(state[item], item).toBe(false)
  })

  // A one-word summary passes a "not empty" check and still tells a reader
  // nothing, which is the whole reason the listing shows it on its own.
  it('nie uznaje jednego slowa za opis', () => {
    expect(checklistState({ ...complete, summary: 'Kotly' }).summary).toBe(false)
    expect(checklistState({ ...complete, description: 'Krotko.' }).description).toBe(false)
  })

  it('puste linki to nie sa linki', () => {
    expect(checklistState({ ...complete, links: {} }).links).toBe(false)
    expect(checklistState({ ...complete, links: { source: '' } }).links).toBe(false)
  })

  it('nieodznaczone deklaracje sa poprawna odpowiedzia', () => {
    expect(checklistState({ ...complete, disclosures: {} }).disclosures).toBe(true)
  })
})

describe('co blokuje wyslanie', () => {
  it('kompletny projekt jest gotowy', () => {
    expect(isReadyToSubmit(complete)).toBe(true)
    expect(missingRequired(checklistState(complete))).toEqual([])
  })

  it('brak wersji zatrzymuje wyslanie, tak jak serwer', () => {
    expect(isReadyToSubmit({ ...complete, versions: [] })).toBe(false)
    expect(missingRequired(checklistState({ ...complete, versions: [] }))).toEqual(['version'])
  })

  // Ikona i galeria pomagaja, ale projekt bez nich da sie ocenic.
  it('ikona, galeria i linki nie blokuja', () => {
    expect(isReadyToSubmit({ ...complete, icon: null, gallery: [], links: {} })).toBe(true)
  })

  it('wypisuje wszystko, czego brakuje, a nie tylko pierwsze', () => {
    expect(missingRequired(checklistState({}))).toEqual([...REQUIRED])
  })
})
