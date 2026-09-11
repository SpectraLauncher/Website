import { patternById } from './bannerPatterns.ts'

export interface BannerLayer {
  pattern: string
  color: string
}

const LEGACY_COLOR_IDS = [
  'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'
]

export const legacyColorId = (color: string) => Math.max(0, LEGACY_COLOR_IDS.indexOf(color))

export type BannerItem = 'banner' | 'shield'
export type BannerFormat = 'modern' | 'legacy'

export function bannerGive(
  base: string,
  layers: BannerLayer[],
  item: BannerItem,
  format: BannerFormat,
  target = '@p'
): string {
  if (format === 'modern') {
    const patterns = layers
      .map(l => `{pattern:"${l.pattern}",color:"${l.color}"}`)
      .join(',')

    if (item === 'shield') {
      const parts = [`base_color="${base}"`]
      if (layers.length) parts.push(`banner_patterns=[${patterns}]`)
      return `/give ${target} shield[${parts.join(',')}]`
    }

    const comp = layers.length ? `[banner_patterns=[${patterns}]]` : ''
    return `/give ${target} ${base}_banner${comp}`
  }

  const patterns = layers
    .map((l) => {
      const legacy = patternById(l.pattern)?.legacy ?? l.pattern
      return `{Pattern:"${legacy}",Color:${legacyColorId(l.color)}}`
    })
    .join(',')

  if (item === 'shield') {
    const inner = [`Base:${legacyColorId(base)}`]
    if (layers.length) inner.push(`Patterns:[${patterns}]`)
    return `/give ${target} shield{BlockEntityTag:{${inner.join(',')}}} 1`
  }

  const tag = layers.length ? `{BlockEntityTag:{Patterns:[${patterns}]}}` : ''
  return `/give ${target} ${base}_banner${tag} 1`
}

export interface BannerPreset {
  key: string
  base: string
  layers: BannerLayer[]
}

export const BANNER_PRESETS: BannerPreset[] = [
  {
    key: 'creeper',
    base: 'black',
    layers: [
      { pattern: 'creeper', color: 'lime' },
      { pattern: 'border', color: 'green' }
    ]
  },
  {
    key: 'pirate',
    base: 'black',
    layers: [
      { pattern: 'skull', color: 'white' },
      { pattern: 'border', color: 'gray' }
    ]
  },
  {
    key: 'sunrise',
    base: 'orange',
    layers: [
      { pattern: 'circle', color: 'yellow' },
      { pattern: 'half_horizontal_bottom', color: 'red' },
      { pattern: 'gradient_up', color: 'magenta' }
    ]
  },
  {
    key: 'target',
    base: 'white',
    layers: [
      { pattern: 'circle', color: 'red' },
      { pattern: 'straight_cross', color: 'white' },
      { pattern: 'border', color: 'red' }
    ]
  },
  {
    key: 'checker',
    base: 'white',
    layers: [
      { pattern: 'square_top_left', color: 'black' },
      { pattern: 'square_bottom_right', color: 'black' }
    ]
  },
  {
    key: 'nether',
    base: 'red',
    layers: [
      { pattern: 'triangles_bottom', color: 'black' },
      { pattern: 'triangles_top', color: 'black' },
      { pattern: 'stripe_middle', color: 'orange' }
    ]
  },
  {
    key: 'ocean',
    base: 'blue',
    layers: [
      { pattern: 'stripe_bottom', color: 'light_blue' },
      { pattern: 'stripe_middle', color: 'cyan' },
      { pattern: 'gradient', color: 'white' }
    ]
  },
  {
    key: 'royal',
    base: 'purple',
    layers: [
      { pattern: 'flower', color: 'yellow' },
      { pattern: 'border', color: 'yellow' },
      { pattern: 'curly_border', color: 'purple' }
    ]
  }
]
