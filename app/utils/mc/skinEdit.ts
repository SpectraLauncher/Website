import { BANNER_COLORS } from './bannerPatterns.ts'
import { PARTS, SKIN_SIZE, boxFaces, partGeometry, type SkinModel, type UvRect } from './skin.ts'

export type EditorTool = 'pencil' | 'fill' | 'eraser' | 'shade' | 'dither' | 'picker'

export interface SkinRegion {
  id: string
  overlay: boolean
  rects: UvRect[]
}

export function skinRegions(model: SkinModel): SkinRegion[] {
  const out: SkinRegion[] = []

  for (const part of PARTS) {
    const { size } = partGeometry(part, model)
    const [w, h, d] = size

    out.push({ id: part.id, overlay: false, rects: boxFaces(part.uv[0]!, part.uv[1]!, w, h, d) })
    if (part.overlayUv) {
      out.push({ id: part.id, overlay: true, rects: boxFaces(part.overlayUv[0]!, part.overlayUv[1]!, w, h, d) })
    }
  }

  return out
}

export const texelFromUv = (u: number, v: number): [number, number] => [
  Math.min(SKIN_SIZE - 1, Math.max(0, Math.floor(u * SKIN_SIZE))),
  Math.min(SKIN_SIZE - 1, Math.max(0, Math.floor((1 - v) * SKIN_SIZE)))
]

export function line(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let dx = Math.abs(x1 - x0)
  let dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy

  for (;;) {
    out.push([x0, y0])
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }

  return out
}

const rectOf = (regions: SkinRegion[], x: number, y: number): UvRect | null => {
  for (const region of regions) {
    for (const rect of region.rects) {
      if (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) return rect
    }
  }
  return null
}

export function fill(
  data: Uint8ClampedArray,
  regions: SkinRegion[],
  x: number,
  y: number,
  colour: [number, number, number, number]
): Array<[number, number]> {
  const rect = rectOf(regions, x, y)
  if (!rect) return []

  const at = (px: number, py: number) => (py * SKIN_SIZE + px) * 4
  const start = at(x, y)
  const target = [data[start]!, data[start + 1]!, data[start + 2]!, data[start + 3]!]

  const same = (i: number) =>
    data[i] === target[0] && data[i + 1] === target[1] && data[i + 2] === target[2] && data[i + 3] === target[3]

  if (target[0] === colour[0] && target[1] === colour[1] && target[2] === colour[2] && target[3] === colour[3]) return []

  const painted: Array<[number, number]> = []
  const seen = new Uint8Array(SKIN_SIZE * SKIN_SIZE)
  const stack: Array<[number, number]> = [[x, y]]

  while (stack.length) {
    const [px, py] = stack.pop()!
    if (px < rect.x || py < rect.y || px >= rect.x + rect.w || py >= rect.y + rect.h) continue

    const key = py * SKIN_SIZE + px
    if (seen[key]) continue
    seen[key] = 1

    const i = at(px, py)
    if (!same(i)) continue

    painted.push([px, py])
    stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1])
  }

  return painted
}

export const PALETTES: Array<{ id: string, colours: string[] }> = [
  {
    id: 'skin',
    colours: [
      '#ffdcc6', '#f4c9a8', '#e8b18c', '#d69f76', '#c79c7a', '#b07d55',
      '#96603f', '#7a4a30', '#5c3623', '#42261a'
    ]
  },
  {
    id: 'hair',
    colours: [
      '#1b1616', '#2f2320', '#4a3126', '#6b4630', '#8a5a34', '#b07a3c',
      '#d8ae62', '#e8d49a', '#a63d21', '#8d8d8d', '#d9d9d9'
    ]
  },
  {
    id: 'eyes',
    colours: ['#3b2a1d', '#6b4a2a', '#2f6fb5', '#4fa5d8', '#3f8a55', '#6f7b86', '#b5892f']
  },
  {
    id: 'cloth',
    colours: [
      '#2f3b8c', '#3a5fb0', '#2a8c78', '#3f9e4d', '#8cb833', '#c9a227',
      '#c25b28', '#a8322c', '#8e2f6b', '#5a3a8c', '#2b2f38', '#e6e6e6'
    ]
  },
  {
    id: 'grey',
    colours: ['#ffffff', '#d6d6d6', '#adadad', '#858585', '#5c5c5c', '#3d3d3d', '#1f1f1f', '#000000']
  },
  {
    id: 'dye',
    colours: BANNER_COLORS.map(c => c.hex)
  }
]

const MIRROR_PAIR: Record<string, string> = {
  rightArm: 'leftArm',
  leftArm: 'rightArm',
  rightLeg: 'leftLeg',
  leftLeg: 'rightLeg'
}

export function mirrorMap(model: SkinModel): Int32Array {
  const map = new Int32Array(SKIN_SIZE * SKIN_SIZE).fill(-1)
  const byId = new Map(PARTS.map(part => [part.id, part]))

  for (const part of PARTS) {
    const partner = byId.get(MIRROR_PAIR[part.id] ?? part.id)!
    const { size } = partGeometry(part, model)
    const other = partGeometry(partner, model).size
    if (size[0] !== other[0] || size[1] !== other[1] || size[2] !== other[2]) continue

    const layers: Array<[[number, number] | null, [number, number] | null]> = [
      [part.uv, partner.uv],
      [part.overlayUv, partner.overlayUv]
    ]

    for (const [from, to] of layers) {
      if (!from || !to) continue

      const src = boxFaces(from[0], from[1], size[0], size[1], size[2])
      const dst = boxFaces(to[0], to[1], size[0], size[1], size[2])

      src.forEach((rect, face) => {
        const target = dst[face === 0 ? 1 : face === 1 ? 0 : face]!

        for (let y = 0; y < rect.h; y++) {
          for (let x = 0; x < rect.w; x++) {
            const a = (rect.y + y) * SKIN_SIZE + rect.x + x
            const b = (target.y + y) * SKIN_SIZE + target.x + (target.w - 1 - x)
            map[a] = b
          }
        }
      })
    }
  }

  return map
}

export function brushCells(x: number, y: number, size: number): Array<[number, number]> {
  if (size <= 1) return [[x, y]]

  const out: Array<[number, number]> = []
  const from = -Math.floor((size - 1) / 2)

  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const px = x + from + dx
      const py = y + from + dy
      if (px < 0 || py < 0 || px >= SKIN_SIZE || py >= SKIN_SIZE) continue
      out.push([px, py])
    }
  }

  return out
}

export const shadeChannel = (value: number, amount: number) =>
  amount > 0 ? value + (255 - value) * amount : value + value * amount
