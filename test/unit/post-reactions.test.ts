import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { REACTIONS, REACTION_IDS, isReaction, reactionTally } from '../../shared/utils/post-reactions'

const read = (file: string) => readFileSync(file, 'utf8')

describe('rodzaje reakcji', () => {
  it('kazda ma ikone i kolor, zadna nie jest emoji', () => {
    for (const reaction of REACTIONS) {
      expect(reaction.icon, reaction.id).toMatch(/^i-pixelarticons-/)
      expect(reaction.tone, reaction.id).toMatch(/^#[0-9a-f]{6}$/i)
      // an emoji would render in whatever font the reader's system picks
      expect(reaction.id).toMatch(/^[a-z]+$/)
    }
  })

  it('identyfikatory sie nie powtarzaja', () => {
    expect(new Set(REACTION_IDS).size).toBe(REACTIONS.length)
  })

  it('przyjmuje tylko znane rodzaje', () => {
    for (const id of REACTION_IDS) expect(isReaction(id), id).toBe(true)

    for (const value of ['', 'love', 'LIKE', 'like ', null, undefined, 0, {}]) {
      expect(isReaction(value), String(value)).toBe(false)
    }
  })
})

describe('zliczanie', () => {
  it('rodzaj, ktorego nikt nie wybral, to zero, nie brak', () => {
    const tally = reactionTally([{ kind: 'like', n: 3 }])

    expect(tally.like).toBe(3)
    for (const id of REACTION_IDS) expect(typeof tally[id], id).toBe('number')
  })

  // A row for a kind that has since been removed from the registry must not
  // appear as a button nobody can read.
  it('nieznany rodzaj z bazy jest pomijany', () => {
    const tally = reactionTally([{ kind: 'wat', n: 9 }, { kind: 'agree', n: 2 }])

    expect(tally.agree).toBe(2)
    expect(Object.keys(tally).sort()).toEqual([...REACTION_IDS].sort())
  })
})

describe('jak sie je zapisuje', () => {
  it('jedna osoba, jeden rodzaj, jeden wiersz', () => {
    const schema = read('server/utils/schema-post.ts')

    // the key is the whole rule: no counter to drift from the rows it counts
    expect(schema).toMatch(/PRIMARY KEY \(post_id, user_id, kind\)/)
  })

  it('drugie klikniecie zabiera reakcje', () => {
    const source = read('server/utils/post-reactions.ts')

    expect(source).toMatch(/DELETE FROM post_reaction[\s\S]*?RETURNING kind/)
    expect(source).toMatch(/ON CONFLICT DO NOTHING/)
  })

  it('reagowanie wymaga zalogowania', () => {
    const route = read('server/api/news/[slug]/reactions.post.ts')

    expect(route).toMatch(/requireUser\(event\)/)
    expect(route).toMatch(/isReaction\(body\.kind\)/)
    // only a published article, so a draft cannot be reacted to by its address
    expect(route).toMatch(/publishedArticle\(/)
  })
})

describe('animacja', () => {
  const component = read('app/components/news/Reactions.vue')

  it('jest animacja przy dodaniu', () => {
    expect(component).toMatch(/@keyframes reaction-pop/)
    expect(component).toMatch(/@keyframes reaction-spark/)
  })

  it('szanuje wylaczone animacje', () => {
    expect(component).toMatch(/prefers-reduced-motion: reduce/)
  })

  it('licznik odpowiada od razu i cofa sie przy bledzie', () => {
    expect(component).toMatch(/catch \{/)
    expect(component).toMatch(/adding \? -1 : 1/)
  })
})
