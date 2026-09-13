/**
 * What a reader can say about an article without writing a comment.
 *
 * Icons rather than emoji: an emoji is a font the reader's system picks, so the
 * same reaction is a different drawing on every machine and none of them match
 * the rest of the page. These are the same pixel set as everything else here.
 *
 * To add one: an entry here and a `reactions.<id>` string per locale. The tone
 * is what the button turns when it is yours.
 */
export const REACTIONS = [
  { id: 'like', icon: 'i-pixelarticons-heart', tone: '#f87171' },
  { id: 'agree', icon: 'i-pixelarticons-thumbs-up', tone: '#38bdf8' },
  { id: 'useful', icon: 'i-pixelarticons-lightbulb-on', tone: '#f59e0b' },
  { id: 'hype', icon: 'i-pixelarticons-fire', tone: '#fb923c' },
] as const

export type ReactionId = typeof REACTIONS[number]['id']

export interface ReactionState {
  counts: Record<ReactionId, number>
  /** What this reader has picked. Empty for somebody not signed in. */
  mine: ReactionId[]
}

export const REACTION_IDS = REACTIONS.map(reaction => reaction.id) as ReactionId[]

export function isReaction(value: unknown): value is ReactionId {
  return (REACTION_IDS as readonly string[]).includes(String(value))
}

/** Counts for every kind, including the ones nobody has picked. */
export function reactionTally(rows: Array<{ kind: string, n: number }>): Record<ReactionId, number> {
  const out = Object.fromEntries(REACTION_IDS.map(id => [id, 0])) as Record<ReactionId, number>

  for (const row of rows) {
    if (isReaction(row.kind)) out[row.kind] = Number(row.n) || 0
  }

  return out
}
