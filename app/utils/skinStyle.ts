export type LightId = 'flat' | 'studio' | 'soft' | 'dramatic' | 'sunset' | 'night'
export type EffectId = 'none' | 'comic' | 'statue' | 'ice' | 'hologram' | 'plastic'

export interface Lamp {
  dir: [number, number, number]
  colour: [number, number, number]
  intensity: number
  specular: number
  shininess: number
}

export interface Light {
  sky: [number, number, number]
  ground: [number, number, number]
  ambient: number
  lamps: Lamp[]
  rim: number
  rimColour: [number, number, number]
}

const norm = (v: [number, number, number]): [number, number, number] => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

const lamp = (
  dir: [number, number, number],
  intensity: number,
  colour: [number, number, number] = [1, 1, 1],
  specular = 0,
  shininess = 28
): Lamp => ({ dir: norm(dir), colour, intensity, specular, shininess })

export const LIGHTS: Record<LightId, Light | null> = {
  flat: null,

  studio: {
    sky: [1, 1, 1],
    ground: [0.55, 0.57, 0.62],
    ambient: 0.5,
    lamps: [
      lamp([-0.55, 0.8, 0.75], 0.6, [1, 0.99, 0.96], 0.1),
      lamp([0.8, 0.25, 0.45], 0.16, [0.82, 0.86, 1]),
      lamp([0.25, 0.45, -1], 0.3)
    ],
    rim: 0,
    rimColour: [1, 1, 1]
  },

  soft: {
    sky: [1, 1, 1],
    ground: [0.72, 0.74, 0.8],
    ambient: 0.62,
    lamps: [
      lamp([-0.35, 0.8, 0.9], 0.34),
      lamp([0.7, 0.2, 0.4], 0.12, [0.88, 0.9, 1])
    ],
    rim: 0,
    rimColour: [1, 1, 1]
  },

  dramatic: {
    sky: [0.78, 0.8, 0.92],
    ground: [0.1, 0.11, 0.16],
    ambient: 0.22,
    lamps: [
      lamp([-1, 0.5, 0.3], 1, [1, 0.98, 0.94], 0.18, 40),
      lamp([0.5, 0.4, -0.9], 0.8),
      lamp([0.6, 0.1, 0.5], 0.06, [0.7, 0.78, 1])
    ],
    rim: 0,
    rimColour: [1, 1, 1]
  },

  sunset: {
    sky: [0.6, 0.68, 1],
    ground: [0.38, 0.3, 0.34],
    ambient: 0.38,
    lamps: [
      lamp([-0.85, 0.35, 0.5], 0.9, [1, 0.7, 0.4], 0.1, 32),
      lamp([0.6, 0.3, -0.8], 0.55, [1, 0.56, 0.34]),
      lamp([0.7, 0.35, 0.4], 0.14, [0.5, 0.6, 1])
    ],
    rim: 0,
    rimColour: [1, 0.78, 0.5]
  },

  night: {
    sky: [0.45, 0.55, 0.92],
    ground: [0.1, 0.12, 0.22],
    ambient: 0.34,
    lamps: [
      lamp([-0.4, 0.8, 0.55], 0.55, [0.65, 0.76, 1], 0.16, 48),
      lamp([0.4, 0.4, -0.9], 0.48, [0.5, 0.65, 1]),
      lamp([0.8, 0.15, 0.3], 0.1, [0.4, 0.5, 0.9])
    ],
    rim: 0,
    rimColour: [0.7, 0.85, 1]
  }
}

export const LIGHT_IDS = Object.keys(LIGHTS) as LightId[]
export const EFFECT_IDS: EffectId[] = ['none', 'comic', 'statue', 'ice', 'hologram', 'plastic']

export const isLightId = (v: string): v is LightId => LIGHT_IDS.includes(v as LightId)
export const isEffectId = (v: string): v is EffectId => EFFECT_IDS.includes(v as EffectId)

export interface Frame {
  data: Uint8ClampedArray
  depth: Float32Array
  width: number
  height: number
}

const luma = (r: number, g: number, b: number) => (r * 0.299 + g * 0.587 + b * 0.114) / 255

const mix = (a: number, b: number, t: number) => a + (b - a) * t

function edgeMap(frame: Frame, jump: number): Uint8Array {
  const { width, height, depth, data } = frame
  const out = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (data[i * 4 + 3]! < 16) continue

      const here = depth[i]!
      let edge = 0

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) { edge = 1; break }
        const n = ny * width + nx
        if (data[n * 4 + 3]! < 16 || Math.abs(depth[n]! - here) > jump) { edge = 1; break }
      }

      out[i] = edge
    }
  }

  return out
}

const tint = (frame: Frame, fn: (r: number, g: number, b: number, i: number) => [number, number, number]) => {
  const { data } = frame
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 16) continue
    const [r, g, b] = fn(data[i]!, data[i + 1]!, data[i + 2]!, i / 4)
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
}

export const DEFAULT_RIM_DIR: [number, number, number] = [-0.6, 0.7, 0.5]

export const keyDir = (light: Light | null): [number, number, number] =>
  light?.lamps[0]?.dir ?? DEFAULT_RIM_DIR

export function applyRim(
  frame: Frame,
  dir: [number, number],
  colour: [number, number, number],
  strength: number,
  radius: number
): void {
  if (strength <= 0 || radius < 1) return

  const { data, width, height } = frame
  const len = Math.hypot(dir[0], dir[1]) || 1
  const stepX = dir[0] / len
  const stepY = dir[1] / len

  const covered = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false
    return data[(y * width + x) * 4 + 3]! >= 16
  }

  const glow = new Float32Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!covered(x, y)) continue
      for (let t = 1; t <= radius; t++) {
        if (covered(Math.round(x + stepX * t), Math.round(y + stepY * t))) continue
        const fade = 1 - (t - 1) / radius
        glow[y * width + x] = fade * fade * fade
        break
      }
    }
  }

  for (let i = 0; i < glow.length; i++) {
    const g = glow[i]!
    if (g <= 0) continue
    const add = g * strength * 255
    const o = i * 4
    data[o] = data[o]! + add * colour[0]
    data[o + 1] = data[o + 1]! + add * colour[1]
    data[o + 2] = data[o + 2]! + add * colour[2]
  }
}

export function applyEffect(id: EffectId, frame: Frame): void {
  if (id === 'none') return

  const { data, width } = frame

  if (id === 'statue') {
    tint(frame, (r, g, b) => {
      const l = mix(0.28, 1.02, luma(r, g, b))
      return [l * 176, l * 172, l * 164]
    })
    const edge = edgeMap(frame, 1.2)
    for (let i = 0; i < edge.length; i++) {
      if (!edge[i]) continue
      for (let c = 0; c < 3; c++) data[i * 4 + c] = data[i * 4 + c]! * 0.72
    }
    return
  }

  if (id === 'comic') {
    tint(frame, (r, g, b) => {
      const step = (v: number) => Math.round((v / 255) * 4.5) / 4.5 * 255
      return [step(r), step(g), step(b)]
    })
    const edge = edgeMap(frame, 0.9)
    for (let i = 0; i < edge.length; i++) {
      if (!edge[i]) continue
      data[i * 4] = 18
      data[i * 4 + 1] = 16
      data[i * 4 + 2] = 24
    }
    return
  }

  if (id === 'ice') {
    const edge = edgeMap(frame, 1.2)
    tint(frame, (r, g, b, i) => {
      const l = luma(r, g, b)
      const base: [number, number, number] = [
        mix(r, 150 + l * 90, 0.72),
        mix(g, 196 + l * 55, 0.72),
        mix(b, 236 + l * 19, 0.72)
      ]
      if (!edge[i]) return base
      return [mix(base[0], 255, 0.6), mix(base[1], 255, 0.7), mix(base[2], 255, 0.8)]
    })
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 16) continue
      data[i + 3] = 232
    }
    return
  }

  if (id === 'hologram') {
    const edge = edgeMap(frame, 1.2)
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 16) continue
      const pixel = i / 4
      const l = luma(data[i]!, data[i + 1]!, data[i + 2]!)
      const row = Math.floor(pixel / width)
      const scan = row % 3 === 0 ? 0.55 : 1
      const glow = edge[pixel] ? 1.55 : 1

      data[i] = 40 * l * scan * glow
      data[i + 1] = (150 + l * 105) * scan * glow
      data[i + 2] = (190 + l * 65) * scan * glow
      data[i + 3] = Math.min(255, (edge[pixel] ? 235 : 150) * scan + 40)
    }
    return
  }

  if (id === 'plastic') {
    tint(frame, (r, g, b) => {
      const l = luma(r, g, b)
      const pop = (v: number) => {
        const t = v / 255
        return Math.min(255, (t + (t - l) * 0.45) * 255 * 1.06)
      }
      return [pop(r), pop(g), pop(b)]
    })
  }
}
