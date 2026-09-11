export type CircleShape = 'circle' | 'ellipse' | 'sphere'
export type CircleStyle = 'thin' | 'thick' | 'filled'

export interface CircleOptions {
  shape: CircleShape
  width: number
  height: number
  style: CircleStyle
}

const offset = (i: number, size: number) => i + 0.5 - size / 2

const inEllipse = (dx: number, dz: number, rx: number, rz: number) =>
  rx > 0 && rz > 0 && (dx * dx) / (rx * rx) + (dz * dz) / (rz * rz) <= 1

const inEllipsoid = (dx: number, dy: number, dz: number, rx: number, ry: number, rz: number) =>
  rx > 0 && ry > 0 && rz > 0
  && (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz) <= 1

export const THICKNESS: Record<CircleStyle, number> = {
  thin: 1,
  thick: 2,
  filled: 0,
}

export interface Layer {
  cells: boolean[][]
  count: number
}

export function buildLayer(opts: CircleOptions, index = 0): Layer {
  const { shape, style } = opts
  const w = Math.max(1, Math.floor(opts.width))
  const h = Math.max(1, Math.floor(opts.height))

  const gridW = w
  const gridD = shape === 'sphere' ? w : h
  const t = THICKNESS[style]

  const rx = w / 2
  const rz = gridD / 2
  const ry = h / 2

  const dy = shape === 'sphere' ? offset(index, h) : 0

  const cells: boolean[][] = []
  let count = 0

  for (let z = 0; z < gridD; z++) {
    const row: boolean[] = []
    const dz = offset(z, gridD)

    for (let x = 0; x < gridW; x++) {
      const dx = offset(x, gridW)

      let on: boolean
      if (shape === 'sphere') {
        const inside = inEllipsoid(dx, dy, dz, rx, ry, rz)
        on = t === 0
          ? inside
          : inside && !inEllipsoid(dx, dy, dz, rx - t, ry - t, rz - t)
      } else {
        const inside = inEllipse(dx, dz, rx, rz)
        on = t === 0
          ? inside
          : inside && !inEllipse(dx, dz, rx - t, rz - t)
      }

      row.push(on)
      if (on) count++
    }
    cells.push(row)
  }

  return { cells, count }
}

export const layerCount = (opts: CircleOptions) =>
  opts.shape === 'sphere' ? Math.max(1, Math.floor(opts.height)) : 1

export function totalBlocks(opts: CircleOptions): number {
  let total = 0
  for (let i = 0; i < layerCount(opts); i++) total += buildLayer(opts, i).count
  return total
}

export interface Dimensions {
  width: number
  height: number
  depth: number
}

export const dimensions = (opts: CircleOptions): Dimensions => {
  const w = Math.max(1, Math.floor(opts.width))
  const h = Math.max(1, Math.floor(opts.height))
  return opts.shape === 'sphere'
    ? { width: w, height: h, depth: w }
    : { width: w, height: 1, depth: h }
}

export const MAX_SIZE = 128
