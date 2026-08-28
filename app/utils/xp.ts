export function totalXpForLevel(level: number): number {
  const n = Math.max(0, Math.floor(level))
  if (n <= 16) return n * n + 6 * n
  if (n <= 31) return Math.round(2.5 * n * n - 40.5 * n + 360)
  return Math.round(4.5 * n * n - 162.5 * n + 2220)
}

export function xpToNextLevel(level: number): number {
  const n = Math.max(0, Math.floor(level))
  if (n <= 15) return 2 * n + 7
  if (n <= 30) return 5 * n - 38
  return 9 * n - 158
}

export interface LevelFromXp {
  level: number
  intoLevel: number
  toNext: number
  progress: number
}

export function levelFromXp(points: number): LevelFromXp {
  const total = Math.max(0, Math.floor(points))
  let level = 0
  while (totalXpForLevel(level + 1) <= total) level++

  const intoLevel = total - totalXpForLevel(level)
  const span = xpToNextLevel(level)
  return {
    level,
    intoLevel,
    toNext: span - intoLevel,
    progress: span > 0 ? intoLevel / span : 0
  }
}

export const xpBetweenLevels = (from: number, to: number) =>
  Math.max(0, totalXpForLevel(to) - totalXpForLevel(from))

export const BOTTLE_MIN = 3
export const BOTTLE_MAX = 11
export const BOTTLE_AVG = 7

export interface BottleEstimate {
  average: number
  best: number
  worst: number
}

export const bottlesFor = (points: number): BottleEstimate => ({
  average: Math.ceil(points / BOTTLE_AVG),
  best: Math.ceil(points / BOTTLE_MAX),
  worst: Math.ceil(points / BOTTLE_MIN)
})

export interface XpSource {
  key: string
  group: 'mobs' | 'blocks' | 'smelting' | 'other'
  min: number
  max: number
}

export const XP_SOURCES: XpSource[] = [
  { key: 'hostile_mob', group: 'mobs', min: 5, max: 5 },
  { key: 'passive_mob', group: 'mobs', min: 1, max: 3 },
  { key: 'blaze', group: 'mobs', min: 10, max: 10 },
  { key: 'enderman', group: 'mobs', min: 5, max: 5 },
  { key: 'wither_skeleton', group: 'mobs', min: 5, max: 5 },
  { key: 'guardian', group: 'mobs', min: 10, max: 10 },
  { key: 'baby_bonus', group: 'mobs', min: 6, max: 42 },
  { key: 'wither', group: 'mobs', min: 50, max: 50 },
  { key: 'ender_dragon_first', group: 'mobs', min: 12000, max: 12000 },
  { key: 'ender_dragon_respawn', group: 'mobs', min: 500, max: 500 },
  { key: 'coal_ore', group: 'blocks', min: 0, max: 2 },
  { key: 'diamond_ore', group: 'blocks', min: 3, max: 7 },
  { key: 'emerald_ore', group: 'blocks', min: 3, max: 7 },
  { key: 'lapis_ore', group: 'blocks', min: 2, max: 5 },
  { key: 'redstone_ore', group: 'blocks', min: 1, max: 5 },
  { key: 'nether_quartz_ore', group: 'blocks', min: 2, max: 5 },
  { key: 'nether_gold_ore', group: 'blocks', min: 0, max: 1 },
  { key: 'spawner', group: 'blocks', min: 15, max: 43 },
  { key: 'sculk', group: 'blocks', min: 1, max: 1 },
  { key: 'smelt_iron', group: 'smelting', min: 0.7, max: 0.7 },
  { key: 'smelt_gold', group: 'smelting', min: 1, max: 1 },
  { key: 'smelt_diamond', group: 'smelting', min: 1, max: 1 },
  { key: 'smelt_food', group: 'smelting', min: 0.35, max: 0.35 },
  { key: 'smelt_glass', group: 'smelting', min: 0.1, max: 0.1 },
  { key: 'bottle', group: 'other', min: 3, max: 11 },
  { key: 'breeding', group: 'other', min: 1, max: 7 },
  { key: 'fishing', group: 'other', min: 1, max: 6 },
  { key: 'trading', group: 'other', min: 3, max: 6 },
  { key: 'grindstone', group: 'other', min: 0, max: 0 }
]
