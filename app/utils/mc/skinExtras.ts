import { capeFaces, type UvRect } from './skin.ts'
import { PIVOTS, type Joint, type Pose, type PoseVec } from './skinPose.ts'
import { FONT_BASELINE, FONT_CELL, FONT_ROWS, glyphRows, textWidth } from './monocraft.ts'

export interface Attachment {
  size: PoseVec
  centre: PoseVec
  faces: UvRect[]
  joints: Joint[]
}

const CAPE_TILT = 9

export function capeAttachment(pose: Pose, scale: number, torso: Joint[]): Attachment {
  return {
    size: [10, 16, 1],
    centre: [0, 16, -2.5],
    faces: capeFaces(scale),
    joints: [{ pivot: [0, 24, -2], rotation: [CAPE_TILT, 0, 0] }, ...torso]
  }
}

export const torsoJoints = (pose: Pose): Joint[] => {
  const tilt = (pose.parts.body ?? [0, 0, 0]) as PoseVec
  const move = pose.offsets?.body as PoseVec | undefined
  return tilt[0] || tilt[1] || tilt[2] || move
    ? [{ pivot: PIVOTS.body!, rotation: tilt, offset: move }]
    : []
}

export interface Nametag {
  width: number
  height: number
  draw: (data: Uint8ClampedArray, imageWidth: number, left: number, top: number) => void
}

const TAG_PAD_X = 2
const TAG_PAD_Y = 1

export function nametag(text: string, scale: number): Nametag {
  const clean = [...text].filter(c => c >= ' ' && c <= '~').join('').slice(0, 24)
  const inner = textWidth(clean)
  const width = (inner + TAG_PAD_X * 2) * scale
  const height = (FONT_ROWS + TAG_PAD_Y * 2) * scale

  const draw = (data: Uint8ClampedArray, imageWidth: number, left: number, top: number) => {
    const put = (px: number, py: number, r: number, g: number, b: number, a: number) => {
      if (px < 0 || py < 0 || px >= imageWidth) return
      const o = (py * imageWidth + px) * 4
      if (o < 0 || o + 3 >= data.length) return
      const src = a / 255
      const dst = data[o + 3]! / 255
      const out = src + dst * (1 - src)
      if (out <= 0) return
      data[o] = (r * src + data[o]! * dst * (1 - src)) / out
      data[o + 1] = (g * src + data[o + 1]! * dst * (1 - src)) / out
      data[o + 2] = (b * src + data[o + 2]! * dst * (1 - src)) / out
      data[o + 3] = out * 255
    }

    const block = (x: number, y: number, r: number, g: number, b: number, a: number) => {
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) put(x + dx, y + dy, r, g, b, a)
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) put(left + x, top + y, 0, 0, 0, 64)
    }

    let pen = left + TAG_PAD_X * scale

    for (const char of clean) {
      const rows = glyphRows(char)
      for (let ry = 0; ry < FONT_ROWS; ry++) {
        const mask = rows[ry] ?? 0
        for (let rx = 0; rx < FONT_CELL; rx++) {
          if (!(mask & (1 << rx))) continue
          const x = pen + rx * scale
          const y = top + (TAG_PAD_Y + ry) * scale
          block(x + scale, y + scale, 62, 62, 62, 255)
          block(x, y, 255, 255, 255, 255)
        }
      }
      pen += (FONT_CELL + 1) * scale
    }
  }

  return { width, height, draw }
}

export const NAMETAG_BASELINE = FONT_BASELINE
