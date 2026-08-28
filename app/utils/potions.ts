export type PotionCategory = 'positive' | 'negative' | 'base'
export type PotionVariant = 'base' | 'long' | 'strong'
export type PotionItem = 'potion' | 'splash_potion' | 'lingering_potion' | 'tipped_arrow'
export type PotionFormat = 'modern' | 'legacy'

export const POTION_VARIANTS: PotionVariant[] = ['base', 'long', 'strong']
export const POTION_ITEMS: PotionItem[] = ['potion', 'splash_potion', 'lingering_potion', 'tipped_arrow']
export const POTION_CATEGORIES: PotionCategory[] = ['positive', 'negative', 'base']

export interface PotionEffect {
  effect: string
  level: number
  seconds: number
}

export interface BrewStep {
  ingredient: string
  result: string
}

export interface PotionForm {
  id: string
  effects: PotionEffect[]
}

export interface Potion {
  key: string
  cat: PotionCategory
  color: string
  brew?: BrewStep[]
  alt?: BrewStep & { from: string }
  forms: Partial<Record<PotionVariant, PotionForm>>
}

const NETHER_WART: BrewStep = { ingredient: 'nether_wart', result: 'awkward' }

const eff = (effect: string, seconds: number, level = 1): PotionEffect => ({ effect, level, seconds })

export const POTIONS: Potion[] = [
  {
    key: 'swiftness',
    cat: 'positive',
    color: '#33EBFF',
    brew: [NETHER_WART, { ingredient: 'sugar', result: 'swiftness' }],
    forms: {
      base: { id: 'swiftness', effects: [eff('speed', 180)] },
      long: { id: 'long_swiftness', effects: [eff('speed', 480)] },
      strong: { id: 'strong_swiftness', effects: [eff('speed', 90, 2)] }
    }
  },
  {
    key: 'leaping',
    cat: 'positive',
    color: '#FDFF84',
    brew: [NETHER_WART, { ingredient: 'rabbit_foot', result: 'leaping' }],
    forms: {
      base: { id: 'leaping', effects: [eff('jump_boost', 180)] },
      long: { id: 'long_leaping', effects: [eff('jump_boost', 480)] },
      strong: { id: 'strong_leaping', effects: [eff('jump_boost', 90, 2)] }
    }
  },
  {
    key: 'strength',
    cat: 'positive',
    color: '#FFC700',
    brew: [NETHER_WART, { ingredient: 'blaze_powder', result: 'strength' }],
    forms: {
      base: { id: 'strength', effects: [eff('strength', 180)] },
      long: { id: 'long_strength', effects: [eff('strength', 480)] },
      strong: { id: 'strong_strength', effects: [eff('strength', 90, 2)] }
    }
  },
  {
    key: 'healing',
    cat: 'positive',
    color: '#F82423',
    brew: [NETHER_WART, { ingredient: 'glistering_melon_slice', result: 'healing' }],
    forms: {
      base: { id: 'healing', effects: [eff('instant_health', 0)] },
      strong: { id: 'strong_healing', effects: [eff('instant_health', 0, 2)] }
    }
  },
  {
    key: 'regeneration',
    cat: 'positive',
    color: '#CD5CAB',
    brew: [NETHER_WART, { ingredient: 'ghast_tear', result: 'regeneration' }],
    forms: {
      base: { id: 'regeneration', effects: [eff('regeneration', 45)] },
      long: { id: 'long_regeneration', effects: [eff('regeneration', 90)] },
      strong: { id: 'strong_regeneration', effects: [eff('regeneration', 22, 2)] }
    }
  },
  {
    key: 'fire_resistance',
    cat: 'positive',
    color: '#FF9900',
    brew: [NETHER_WART, { ingredient: 'magma_cream', result: 'fire_resistance' }],
    forms: {
      base: { id: 'fire_resistance', effects: [eff('fire_resistance', 180)] },
      long: { id: 'long_fire_resistance', effects: [eff('fire_resistance', 480)] }
    }
  },
  {
    key: 'water_breathing',
    cat: 'positive',
    color: '#98DAC0',
    brew: [NETHER_WART, { ingredient: 'pufferfish', result: 'water_breathing' }],
    forms: {
      base: { id: 'water_breathing', effects: [eff('water_breathing', 180)] },
      long: { id: 'long_water_breathing', effects: [eff('water_breathing', 480)] }
    }
  },
  {
    key: 'night_vision',
    cat: 'positive',
    color: '#C2FF66',
    brew: [NETHER_WART, { ingredient: 'golden_carrot', result: 'night_vision' }],
    forms: {
      base: { id: 'night_vision', effects: [eff('night_vision', 180)] },
      long: { id: 'long_night_vision', effects: [eff('night_vision', 480)] }
    }
  },
  {
    key: 'invisibility',
    cat: 'positive',
    color: '#F6F6F6',
    brew: [
      NETHER_WART,
      { ingredient: 'golden_carrot', result: 'night_vision' },
      { ingredient: 'fermented_spider_eye', result: 'invisibility' }
    ],
    forms: {
      base: { id: 'invisibility', effects: [eff('invisibility', 180)] },
      long: { id: 'long_invisibility', effects: [eff('invisibility', 480)] }
    }
  },
  {
    key: 'slow_falling',
    cat: 'positive',
    color: '#F3CFB9',
    brew: [NETHER_WART, { ingredient: 'phantom_membrane', result: 'slow_falling' }],
    forms: {
      base: { id: 'slow_falling', effects: [eff('slow_falling', 90)] },
      long: { id: 'long_slow_falling', effects: [eff('slow_falling', 240)] }
    }
  },
  {
    key: 'luck',
    cat: 'positive',
    color: '#59C106',
    forms: {
      base: { id: 'luck', effects: [eff('luck', 300)] }
    }
  },
  {
    key: 'turtle_master',
    cat: 'positive',
    color: '#8D82E6',
    brew: [NETHER_WART, { ingredient: 'turtle_shell', result: 'turtle_master' }],
    forms: {
      base: { id: 'turtle_master', effects: [eff('slowness', 20, 4), eff('resistance', 20, 3)] },
      long: { id: 'long_turtle_master', effects: [eff('slowness', 40, 4), eff('resistance', 40, 3)] },
      strong: { id: 'strong_turtle_master', effects: [eff('slowness', 20, 6), eff('resistance', 20, 4)] }
    }
  },
  {
    key: 'wind_charging',
    cat: 'negative',
    color: '#BDC9FF',
    brew: [NETHER_WART, { ingredient: 'breeze_rod', result: 'wind_charging' }],
    forms: {
      base: { id: 'wind_charged', effects: [eff('wind_charged', 180)] }
    }
  },
  {
    key: 'oozing',
    cat: 'negative',
    color: '#99FFA3',
    brew: [NETHER_WART, { ingredient: 'slime_block', result: 'oozing' }],
    forms: {
      base: { id: 'oozing', effects: [eff('oozing', 180)] }
    }
  },
  {
    key: 'weaving',
    cat: 'negative',
    color: '#78695A',
    brew: [NETHER_WART, { ingredient: 'cobweb', result: 'weaving' }],
    forms: {
      base: { id: 'weaving', effects: [eff('weaving', 180)] }
    }
  },
  {
    key: 'infestation',
    cat: 'negative',
    color: '#8C9B8C',
    brew: [NETHER_WART, { ingredient: 'stone', result: 'infestation' }],
    forms: {
      base: { id: 'infested', effects: [eff('infested', 180)] }
    }
  },
  {
    key: 'slowness',
    cat: 'negative',
    color: '#8BAFE0',
    brew: [
      NETHER_WART,
      { ingredient: 'sugar', result: 'swiftness' },
      { ingredient: 'fermented_spider_eye', result: 'slowness' }
    ],
    alt: { from: 'leaping', ingredient: 'fermented_spider_eye', result: 'slowness' },
    forms: {
      base: { id: 'slowness', effects: [eff('slowness', 90)] },
      long: { id: 'long_slowness', effects: [eff('slowness', 240)] },
      strong: { id: 'strong_slowness', effects: [eff('slowness', 20, 4)] }
    }
  },
  {
    key: 'poison',
    cat: 'negative',
    color: '#87A363',
    brew: [NETHER_WART, { ingredient: 'spider_eye', result: 'poison' }],
    forms: {
      base: { id: 'poison', effects: [eff('poison', 45)] },
      long: { id: 'long_poison', effects: [eff('poison', 90)] },
      strong: { id: 'strong_poison', effects: [eff('poison', 21, 2)] }
    }
  },
  {
    key: 'harming',
    cat: 'negative',
    color: '#A9656A',
    brew: [
      NETHER_WART,
      { ingredient: 'glistering_melon_slice', result: 'healing' },
      { ingredient: 'fermented_spider_eye', result: 'harming' }
    ],
    alt: { from: 'poison', ingredient: 'fermented_spider_eye', result: 'harming' },
    forms: {
      base: { id: 'harming', effects: [eff('instant_damage', 0)] },
      strong: { id: 'strong_harming', effects: [eff('instant_damage', 0, 2)] }
    }
  },
  {
    key: 'weakness',
    cat: 'negative',
    color: '#484D48',
    brew: [{ ingredient: 'fermented_spider_eye', result: 'weakness' }],
    forms: {
      base: { id: 'weakness', effects: [eff('weakness', 90)] },
      long: { id: 'long_weakness', effects: [eff('weakness', 240)] }
    }
  },
  {
    key: 'water',
    cat: 'base',
    color: '#385DC6',
    brew: [],
    forms: { base: { id: 'water', effects: [] } }
  },
  {
    key: 'awkward',
    cat: 'base',
    color: '#385DC6',
    brew: [NETHER_WART],
    forms: { base: { id: 'awkward', effects: [] } }
  },
  {
    key: 'mundane',
    cat: 'base',
    color: '#385DC6',
    brew: [{ ingredient: 'redstone', result: 'mundane' }],
    forms: { base: { id: 'mundane', effects: [] } }
  },
  {
    key: 'thick',
    cat: 'base',
    color: '#385DC6',
    brew: [{ ingredient: 'glowstone', result: 'thick' }],
    forms: { base: { id: 'thick', effects: [] } }
  }
]

export const potionByKey = (key: string) => POTIONS.find(p => p.key === key)

const TEXTURE_NAMES: Record<string, string> = {
  water: 'Water_Bottle_JE2',
  awkward: 'Water_Bottle_JE2',
  mundane: 'Water_Bottle_JE2',
  thick: 'Water_Bottle_JE2',
  turtle_master: 'Potion_of_the_Turtle_Master'
}

export const potionTexture = (key: string) =>
  `/potions/${TEXTURE_NAMES[key] ?? 'Potion_of_' + key.split('_').map(w => w[0]!.toUpperCase() + w.slice(1)).join('_')}.webp`

const INGREDIENT_NAMES: Record<string, string> = {
  redstone: 'Redstone_Dust',
  glowstone: 'Glowstone_Dust',
  dragon_breath: 'Dragons_Breath'
}

export const ingredientTexture = (key: string) =>
  `/potions/items/${INGREDIENT_NAMES[key] ?? key.split('_').map(w => w[0]!.toUpperCase() + w.slice(1)).join('_')}.webp`

export const variantIngredient = (variant: PotionVariant) =>
  variant === 'long' ? 'redstone' : variant === 'strong' ? 'glowstone' : ''

export const availableVariants = (potion: Potion) =>
  POTION_VARIANTS.filter(v => potion.forms[v])

export const hasEffects = (potion: Potion) =>
  POTION_VARIANTS.some(v => (potion.forms[v]?.effects.length ?? 0) > 0)

export const itemsFor = (potion: Potion) =>
  hasEffects(potion) ? POTION_ITEMS : POTION_ITEMS.filter(i => i !== 'tipped_arrow')

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export const roman = (n: number) => ROMAN[n] ?? String(n)

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  return `${m}:${String(total - m * 60).padStart(2, '0')}`
}

export const LINGERING_FACTOR = 0.25
export const ARROW_FACTOR = 0.125

export function itemDuration(seconds: number, item: PotionItem): number {
  if (!seconds) return 0
  if (item === 'lingering_potion') return Math.round(seconds * LINGERING_FACTOR)
  if (item === 'tipped_arrow') return Math.round(seconds * ARROW_FACTOR)
  return seconds
}

export function potionCommand(id: string, item: PotionItem, format: PotionFormat, target = '@p'): string {
  const payload = format === 'modern'
    ? `[potion_contents={potion:"minecraft:${id}"}]`
    : `{Potion:"minecraft:${id}"}`
  const count = item === 'tipped_arrow' ? ' 8' : ''

  return `/give ${target} minecraft:${item}${payload}${count}`
}

export interface Ingredient {
  key: string
  role: 'fuel' | 'base' | 'effect' | 'modifier'
}

export const INGREDIENTS: Ingredient[] = [
  { key: 'blaze_powder', role: 'fuel' },
  { key: 'nether_wart', role: 'base' },
  { key: 'redstone', role: 'modifier' },
  { key: 'glowstone', role: 'modifier' },
  { key: 'gunpowder', role: 'modifier' },
  { key: 'dragon_breath', role: 'modifier' },
  { key: 'fermented_spider_eye', role: 'modifier' }
]
