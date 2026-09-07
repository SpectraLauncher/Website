import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const page = readFileSync('app/pages/project/[id]/settings/pricing.vue', 'utf8')
const shell = readFileSync('app/pages/project/[id]/settings.vue', 'utf8')
const editor = readFileSync('server/api/catalog/project/[slug]/editor.get.ts', 'utf8')

describe('zakladka z cena', () => {
  it('jest wpieta w ustawienia projektu', () => {
    expect(shell).toContain(`id: 'pricing'`)
    expect(shell).toContain(`to: '/pricing'`)
  })

  // Same guard the rest of the details share: pricing is a detail of the
  // project, not something a translator with edit_body should reach.
  it('wymaga tego samego uprawnienia co reszta szczegolow', () => {
    const line = shell.split('\n').find(l => l.includes(`id: 'pricing'`)) ?? ''
    expect(line).toContain(`need: 'edit_details'`)
  })
})

describe('kalkulacja dla autora', () => {
  // A floor on the fee means the rate alone cannot tell an author what they
  // take home, so the page has to run the real arithmetic. Reimplementing the
  // formula in the template would let the two drift apart silently, and the
  // author's number is the one people plan around.
  it('liczy oplate ta sama funkcja co checkout', () => {
    expect(page).toContain('feeFor(')
    expect(page).not.toMatch(/rateBps\s*\/\s*10_?000/)
  })

  it('bierze stawke z serwera, nie zaszywa jej', () => {
    expect(editor).toContain('termsForProject(project)')
    expect(page).toContain('data.value?.pricing')
  })

  // Cents are what the API stores; euros are what people type. One conversion,
  // at the edge.
  it('wysyla cene w centach', () => {
    expect(page).toContain('Math.round(parsed * 100)')
    expect(page).toContain('body: { price:')
  })

  it('nie pozwala zapisac ceny ponizej minimum', () => {
    expect(page).toContain('tooCheap')
    expect(page).toContain(':disabled="!canSave"')
  })

  // Zero is how the schema says free, so the switch has to write it rather than
  // leaving the old price behind.
  it('wylaczenie platnosci zapisuje zero', () => {
    expect(page).toContain('paid.value ? priceMinor.value : 0')
  })
})
