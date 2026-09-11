import { boxFaces, capeScale, limbFaces, OVERLAY_INFLATE, SKIN_SIZE, type SkinModel, type UvRect } from './skin.ts'
import { capeAttachment, nametag, torsoJoints } from './skinExtras.ts'
import {
  CROPS, cameraFor, mitreOffset, posedParts,
  type Joint, type Pose, type RenderCrop, type PoseVec
} from './skinPose.ts'
import { LIGHTS, applyEffect, applyRim, keyDir, type EffectId, type Light, type LightId } from './skinStyle.ts'

export interface Texture {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface RenderOptions {
  skin: Texture
  pose: Pose
  crop: RenderCrop
  model: SkinModel
  size: number
  light?: LightId
  effect?: EffectId
  cape?: Texture | null
  voxel?: boolean
  nametag?: string
  yaw?: number
  pitch?: number
  rim?: number
}

export interface SkinRenderResult {
  data: Uint8ClampedArray
  width: number
  height: number
}

const RAD = Math.PI / 180

function rotate(p: PoseVec, r: PoseVec): PoseVec {
  const [rx, ry, rz] = [r[0] * RAD, r[1] * RAD, r[2] * RAD]
  let [x, y, z] = p

  const cx = Math.cos(rx), sx = Math.sin(rx)
  ;[y, z] = [y * cx - z * sx, y * sx + z * cx]

  const cz = Math.cos(rz), sz = Math.sin(rz)
  ;[x, y] = [x * cz - y * sz, x * sz + y * cz]

  const cy = Math.cos(ry), sy = Math.sin(ry)
  ;[x, z] = [x * cy + z * sy, -x * sy + z * cy]

  return [x, y, z]
}

const FACE_CORNERS: Array<[PoseVec, PoseVec, PoseVec, PoseVec]> = [
  [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1]],
  [[-1, 1, -1], [-1, 1, 1], [-1, -1, -1], [-1, -1, 1]],
  [[-1, 1, -1], [1, 1, -1], [-1, 1, 1], [1, 1, 1]],
  [[-1, -1, 1], [1, -1, 1], [-1, -1, -1], [1, -1, -1]],
  [[-1, 1, 1], [1, 1, 1], [-1, -1, 1], [1, -1, 1]],
  [[1, 1, -1], [-1, 1, -1], [1, -1, -1], [-1, -1, -1]]
]

const FACE_SHADE = [0.8, 0.8, 1, 0.5, 0.9, 0.9]

interface Vertex { x: number, y: number, z: number, u: number, v: number }

type Rgb = [number, number, number]

function outward(p: PoseVec[]): PoseVec {
  const ax = p[1]![0] - p[0]![0], ay = p[1]![1] - p[0]![1], az = p[1]![2] - p[0]![2]
  const bx = p[2]![0] - p[0]![0], by = p[2]![1] - p[0]![1], bz = p[2]![2] - p[0]![2]

  const nx = -(ay * bz - az * by)
  const ny = -(az * bx - ax * bz)
  const nz = -(ax * by - ay * bx)
  const nl = Math.hypot(nx, ny, nz) || 1

  return [nx / nl, ny / nl, nz / nl]
}

function shadeFace(normal: PoseVec, light: Light, eye: PoseVec): { mul: Rgb, gloss: number } {
  const t = (normal[1] + 1) / 2
  const mul: Rgb = [0, 1, 2].map(c =>
    (light.ground[c]! + (light.sky[c]! - light.ground[c]!) * t) * light.ambient) as Rgb

  let gloss = 0

  for (const lamp of light.lamps) {
    const diffuse = normal[0] * lamp.dir[0] + normal[1] * lamp.dir[1] + normal[2] * lamp.dir[2]
    if (diffuse <= 0) continue

    for (let c = 0; c < 3; c++) mul[c] += diffuse * lamp.intensity * lamp.colour[c]!

    if (lamp.specular <= 0) continue

    const hx = lamp.dir[0] + eye[0]
    const hy = lamp.dir[1] + eye[1]
    const hz = lamp.dir[2] + eye[2]
    const hl = Math.hypot(hx, hy, hz) || 1
    const align = (normal[0] * hx + normal[1] * hy + normal[2] * hz) / hl
    if (align > 0) gloss += Math.pow(align, lamp.shininess) * lamp.specular
  }

  return { mul, gloss: gloss * 255 }
}

export function renderSkin(opts: RenderOptions): SkinRenderResult {
  const spec = CROPS[opts.crop]
  const camera = cameraFor(opts.pose)
  const flat = Boolean(spec.flat)

  const yaw = (flat ? 0 : opts.yaw ?? camera.yaw) * RAD
  const pitch = (flat ? 0 : opts.pitch ?? camera.pitch) * RAD

  const view = (p: PoseVec): PoseVec => {
    const dx = p[0] - camera.target[0]
    const dy = p[1] - camera.target[1]
    const dz = p[2] - camera.target[2]

    const cy = Math.cos(yaw), sy = Math.sin(yaw)
    const x = dx * cy - dz * sy
    const z1 = dx * sy + dz * cy

    const cp = Math.cos(pitch), sp = Math.sin(pitch)
    const y = dy * cp - z1 * sp
    const z = dy * sp + z1 * cp

    return [x, y, z]
  }

  const lamp = LIGHTS[opts.light ?? 'flat']
  const eye: PoseVec = [
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  ]

  const place = (point: PoseVec, joints: Joint[]): PoseVec => {
    let p = point
    for (const joint of joints) {
      const local: PoseVec = [p[0] - joint.pivot[0], p[1] - joint.pivot[1], p[2] - joint.pivot[2]]
      const turned = rotate(local, joint.rotation)
      const move = joint.offset ?? [0, 0, 0]
      p = [
        turned[0] + joint.pivot[0] + move[0],
        turned[1] + joint.pivot[1] + move[1],
        turned[2] + joint.pivot[2] + move[2]
      ]
    }
    return p
  }

  const litFace = (solid: PoseVec[], faceIndex: number) => {
    const flatShade = FACE_SHADE[faceIndex]!
    if (!lamp) return { shade: [flatShade, flatShade, flatShade] as Rgb, gloss: 0 }

    const [nx, ny, nz] = outward(solid)
    const lit = shadeFace([nx, ny, nz], lamp, eye)
    return { shade: lit.mul, gloss: lit.gloss }
  }

  const parts = posedParts(opts.pose, opts.model, spec.overlay)
    .filter(p => !spec.parts || spec.parts.includes(p.part.id))

  const quads: Array<{ corners: PoseVec[], uv: UvRect, shade: Rgb, gloss: number, vShift: number[], tex: number }> = []

  const emit = (local: PoseVec[], joints: Joint[], uv: UvRect, faceIndex: number, tex: number) => {
    const solid = local.map(p => place(p, joints))
    const { shade, gloss } = litFace(solid, faceIndex)
    quads.push({ corners: solid.map(view), uv, shade, gloss, vShift: [0, 0, 0, 0], tex })
  }

  const FACE_OUT: PoseVec[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]

  const VOXEL_DEPTH = 0.6

  const voxelShell = (posed: typeof parts[number]) => {
    const origin = posed.part.overlayUv!
    const faces = posed.segment
      ? limbFaces(
          origin[0], origin[1],
          posed.size[0], posed.part.size[1], posed.size[2],
          posed.segment.fromTop, posed.segment.height
        )
      : boxFaces(origin[0], origin[1], posed.size[0], posed.size[1], posed.size[2])

    const half: PoseVec = [posed.size[0] / 2, posed.size[1] / 2, posed.size[2] / 2]

    const opaque = (tx: number, ty: number) => {
      const x = Math.min(opts.skin.width - 1, Math.max(0, tx))
      const y = Math.min(opts.skin.height - 1, Math.max(0, ty))
      return opts.skin.data[(y * opts.skin.width + x) * 4 + 3]! >= 16
    }

    FACE_CORNERS.forEach((corners, faceIndex) => {
      const rect = faces[faceIndex]!
      const cols = Math.round(rect.w)
      const rows = Math.round(rect.h)
      if (cols < 1 || rows < 1) return

      const out = FACE_OUT[faceIndex]!
      const solid = corners.map(c => [
        posed.centre[0] + c[0] * half[0],
        posed.centre[1] + c[1] * half[1],
        posed.centre[2] + c[2] * half[2]
      ] as PoseVec)

      const at = (u: number, v: number, lift: number): PoseVec => [0, 1, 2].map(k =>
        solid[0]![k]! * (1 - u) * (1 - v)
        + solid[1]![k]! * u * (1 - v)
        + solid[2]![k]! * (1 - u) * v
        + solid[3]![k]! * u * v
        + out[k]! * lift
      ) as PoseVec

      const facing = (p: PoseVec[], ref: PoseVec) => {
        const n = outward(p)
        return n[0] * ref[0]! + n[1] * ref[1]! + n[2] * ref[2]! >= 0 ? p : [p[1]!, p[0]!, p[3]!, p[2]!]
      }

      for (let j = 0; j < rows; j++) {
        const ty = rect.flipV ? rect.y + rows - 1 - j : rect.y + j
        for (let i = 0; i < cols; i++) {
          const tx = rect.x + i
          if (!opaque(tx, ty)) continue

          const texel: UvRect = { x: tx, y: ty, w: 1, h: 1 }
          const u0 = i / cols, u1 = (i + 1) / cols
          const v0 = j / rows, v1 = (j + 1) / rows

          const lid = [at(u0, v0, VOXEL_DEPTH), at(u1, v0, VOXEL_DEPTH), at(u0, v1, VOXEL_DEPTH), at(u1, v1, VOXEL_DEPTH)]
          emit(lid, posed.joints, texel, faceIndex, 0)

          const sides: Array<[boolean, PoseVec[], PoseVec]> = [
            [i === 0 || !opaque(tx - 1, ty),
              [at(u0, v0, VOXEL_DEPTH), at(u0, v0, 0), at(u0, v1, VOXEL_DEPTH), at(u0, v1, 0)],
              [solid[0]![0]! - solid[1]![0]!, solid[0]![1]! - solid[1]![1]!, solid[0]![2]! - solid[1]![2]!]],
            [i === cols - 1 || !opaque(tx + 1, ty),
              [at(u1, v0, 0), at(u1, v0, VOXEL_DEPTH), at(u1, v1, 0), at(u1, v1, VOXEL_DEPTH)],
              [solid[1]![0]! - solid[0]![0]!, solid[1]![1]! - solid[0]![1]!, solid[1]![2]! - solid[0]![2]!]],
            [j === 0 || !opaque(tx, rect.flipV ? ty + 1 : ty - 1),
              [at(u0, v0, 0), at(u1, v0, 0), at(u0, v0, VOXEL_DEPTH), at(u1, v0, VOXEL_DEPTH)],
              [solid[0]![0]! - solid[2]![0]!, solid[0]![1]! - solid[2]![1]!, solid[0]![2]! - solid[2]![2]!]],
            [j === rows - 1 || !opaque(tx, rect.flipV ? ty - 1 : ty + 1),
              [at(u0, v1, VOXEL_DEPTH), at(u1, v1, VOXEL_DEPTH), at(u0, v1, 0), at(u1, v1, 0)],
              [solid[2]![0]! - solid[0]![0]!, solid[2]![1]! - solid[0]![1]!, solid[2]![2]! - solid[0]![2]!]]
          ]

          for (const [open, points, ref] of sides) {
            if (!open) continue
            emit(facing(points, ref), posed.joints, texel, faceIndex, 0)
          }
        }
      }
    })
  }

  for (const posed of parts) {
    if (opts.voxel && posed.overlay) {
      voxelShell(posed)
      continue
    }

    const inflate = posed.overlay ? OVERLAY_INFLATE : 0
    const half: PoseVec = [
      (posed.size[0] + inflate) / 2,
      (posed.size[1] + inflate) / 2,
      (posed.size[2] + inflate) / 2
    ]

    const origin = posed.overlay ? posed.part.overlayUv! : posed.part.uv
    const faces = posed.segment
      ? limbFaces(
          origin[0], origin[1],
          posed.size[0], posed.part.size[1], posed.size[2],
          posed.segment.fromTop, posed.segment.height
        )
      : boxFaces(origin[0], origin[1], posed.size[0], posed.size[1], posed.size[2])

    FACE_CORNERS.forEach((corners, faceIndex) => {
      const shifts: number[] = []

      const solid: PoseVec[] = []

      const world = corners.map((c) => {
        const dx = c[0] * half[0]
        const dz = c[2] * half[2]

        const mitre = posed.mitre && c[1] === posed.mitre.sign
          ? mitreOffset(posed.mitre, dx, dz)
          : 0

        shifts.push(faceIndex === 2 || faceIndex === 3 ? 0 : mitre)

        let point: PoseVec = [
          posed.centre[0] + dx,
          posed.centre[1] + c[1] * half[1] + mitre,
          posed.centre[2] + dz
        ]

        for (const joint of posed.joints) {
          const local: PoseVec = [
            point[0] - joint.pivot[0],
            point[1] - joint.pivot[1],
            point[2] - joint.pivot[2]
          ]
          const turned = rotate(local, joint.rotation)
          const move = joint.offset ?? [0, 0, 0]
          point = [
            turned[0] + joint.pivot[0] + move[0],
            turned[1] + joint.pivot[1] + move[1],
            turned[2] + joint.pivot[2] + move[2]
          ]
        }

        solid.push(point)
        return view(point)
      })

      const { shade, gloss } = litFace(solid, faceIndex)

      quads.push({ corners: world, uv: faces[faceIndex]!, shade, gloss, vShift: shifts, tex: 0 })
    })
  }

  const capeTex = opts.cape ?? null

  if (capeTex && !spec.parts) {
    const scale = capeScale(capeTex.width, capeTex.height)
    const torso = torsoJoints(opts.pose)

    for (const piece of [capeAttachment(opts.pose, scale, torso)]) {
      const half: PoseVec = [piece.size[0] / 2, piece.size[1] / 2, piece.size[2] / 2]
      FACE_CORNERS.forEach((corners, faceIndex) => {
        const local = corners.map(c => [
          piece.centre[0] + c[0] * half[0],
          piece.centre[1] + c[1] * half[1],
          piece.centre[2] + c[2] * half[2]
        ] as PoseVec)
        emit(local, piece.joints, piece.faces[faceIndex]!, faceIndex, 1)
      })
    }
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const quad of quads) {
    for (const c of quad.corners) {
      if (c[0] < minX) minX = c[0]
      if (c[0] > maxX) maxX = c[0]
      if (c[1] < minY) minY = c[1]
      if (c[1] > maxY) maxY = c[1]
    }
  }

  if (!Number.isFinite(minX)) {
    return { data: new Uint8ClampedArray(opts.size * opts.size * 4), width: opts.size, height: opts.size }
  }

  const width = opts.size
  const height = opts.size

  const label = opts.nametag ? nametag(opts.nametag, Math.max(1, Math.round(opts.size / 128))) : null
  const reserve = label ? label.height + Math.round(opts.size * 0.03) : 0

  const spanX = Math.max(0.001, maxX - minX)
  const spanY = Math.max(0.001, maxY - minY)
  const margin = 0.94
  const scale = Math.min(width / spanX, (height - reserve) / spanY) * margin * camera.zoom

  const cx = width / 2 - ((minX + maxX) / 2) * scale
  const cy = (height + reserve) / 2 + ((minY + maxY) / 2) * scale

  const data = new Uint8ClampedArray(width * height * 4)
  const depth = new Float32Array(width * height).fill(-Infinity)

  const project = (c: PoseVec, uv: [number, number]): Vertex => ({
    x: cx + c[0] * scale,
    y: cy - c[1] * scale,
    z: c[2],
    u: uv[0],
    v: uv[1]
  })

  const sample = (u: number, v: number, tex: number) => {
    const src = tex === 1 && capeTex ? capeTex : opts.skin
    const tx = Math.min(src.width - 1, Math.max(0, Math.floor(u)))
    const ty = Math.min(src.height - 1, Math.max(0, Math.floor(v)))
    const o = (ty * src.width + tx) * 4
    return [src.data[o]!, src.data[o + 1]!, src.data[o + 2]!, src.data[o + 3]!]
  }

  const triangle = (a: Vertex, b: Vertex, c: Vertex, shade: Rgb, gloss: number, tex: number) => {
    const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)
    if (Math.abs(area) < 1e-9) return

    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)))
    const x1 = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)))
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)))
    const y1 = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)))

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const sx = px + 0.5
        const sy = py + 0.5

        const wa = ((b.x - sx) * (c.y - sy) - (c.x - sx) * (b.y - sy)) / area
        const wb = ((c.x - sx) * (a.y - sy) - (a.x - sx) * (c.y - sy)) / area
        const wc = 1 - wa - wb
        if (wa < 0 || wb < 0 || wc < 0) continue

        const z = a.z * wa + b.z * wb + c.z * wc
        const index = py * width + px
        if (z <= depth[index]!) continue

        const u = a.u * wa + b.u * wb + c.u * wc
        const v = a.v * wa + b.v * wb + c.v * wc
        const [r, g, bl, alpha] = sample(u, v, tex)
        if (alpha! < 16) continue

        depth[index] = z
        const o = index * 4
        data[o] = r! * shade[0] + gloss
        data[o + 1] = g! * shade[1] + gloss
        data[o + 2] = bl! * shade[2] + gloss
        data[o + 3] = alpha!
      }
    }
  }

  for (const quad of quads) {
    const { x, y, w, h, flipV } = quad.uv
    const top = flipV ? y + h : y
    const bottom = flipV ? y : y + h

    const v = (edge: number, i: number) => edge - quad.vShift[i]!

    const verts = [
      project(quad.corners[0]!, [x + 0.01, v(top + 0.01, 0)]),
      project(quad.corners[1]!, [x + w - 0.01, v(top + 0.01, 1)]),
      project(quad.corners[2]!, [x + 0.01, v(bottom - 0.01, 2)]),
      project(quad.corners[3]!, [x + w - 0.01, v(bottom - 0.01, 3)])
    ]

    triangle(verts[0]!, verts[1]!, verts[2]!, quad.shade, quad.gloss, quad.tex)
    triangle(verts[1]!, verts[3]!, verts[2]!, quad.shade, quad.gloss, quad.tex)
  }

  applyEffect(opts.effect ?? 'none', { data, depth, width, height })

  const rim = opts.rim ?? lamp?.rim ?? 0
  if (rim > 0) {
    const source = keyDir(lamp)
    const cy2 = Math.cos(yaw), sy2 = Math.sin(yaw)
    const cp2 = Math.cos(pitch), sp2 = Math.sin(pitch)
    const sx = source[0] * cy2 - source[2] * sy2
    const sz = source[0] * sy2 + source[2] * cy2
    const sy3 = source[1] * cp2 - sz * sp2

    applyRim(
      { data, depth, width, height },
      [sx, -sy3],
      lamp?.rimColour ?? [1, 1, 1],
      rim,
      Math.max(2, Math.round(opts.size / 90))
    )
  }

  if (label) {
    const top = Math.max(2, Math.round(cy - maxY * scale) - label.height - Math.round(opts.size * 0.02))
    label.draw(data, width, Math.round((width - label.width) / 2), top)
  }

  return { data, width, height }
}

export const emptySkinTexture = (): Texture => ({
  data: new Uint8ClampedArray(SKIN_SIZE * SKIN_SIZE * 4),
  width: SKIN_SIZE,
  height: SKIN_SIZE
})
