import { PARTS, type PartSpec, type SkinModel } from './skin.ts'

export type PoseVec = [number, number, number]

export type RenderCrop = 'full' | 'bust' | 'face' | 'head' | 'default' | 'processed' | 'barebones'

export const RENDER_CROPS: RenderCrop[] = [
  'full', 'bust', 'face', 'head', 'default', 'processed', 'barebones'
]

export interface CropSpec {
  parts: string[] | null
  overlay: boolean
  flat?: boolean
}

const BUST = ['head', 'body', 'rightArm', 'leftArm']

export const CROPS: Record<RenderCrop, CropSpec> = {
  full: { parts: null, overlay: true },
  default: { parts: null, overlay: true },
  processed: { parts: null, overlay: true },
  barebones: { parts: null, overlay: false },
  bust: { parts: BUST, overlay: true },
  head: { parts: ['head'], overlay: true },
  face: { parts: ['head'], overlay: true, flat: true }
}

export const PIVOTS: Record<string, PoseVec> = {
  head: [0, 24, 0],
  body: [0, 12, 0],
  rightArm: [-5, 22, 0],
  leftArm: [5, 22, 0],
  rightLeg: [-2, 12, 0],
  leftLeg: [2, 12, 0]
}

export interface Camera {
  yaw: number
  pitch: number
  distance: number
  target: PoseVec
  zoom: number
}

export interface Pose {
  id: string
  parts: Partial<Record<string, PoseVec>>
  offsets?: Partial<Record<string, PoseVec>>
  camera: Partial<Camera>
}

const DEFAULT_CAMERA: Camera = {
  yaw: 28,
  pitch: 12,
  distance: 70,
  target: [0, 17, 0],
  zoom: 1
}

export const cameraFor = (pose: Pose): Camera => ({ ...DEFAULT_CAMERA, ...pose.camera })

export const POSES: Pose[] = [
  { id: 'default', parts: {}, camera: {} },
  { id: 'front', parts: {}, camera: { yaw: 0, pitch: 0 } },
  { id: 'isometric', parts: {}, camera: { yaw: 45, pitch: 30 } },
  {
    id: 'walking',
    parts: { rightArm: [-30, 0, 0], leftArm: [30, 0, 0], rightLeg: [32, 0, 0], leftLeg: [-32, 0, 0] },
    camera: {}
  },
  {
    id: 'running',
    parts: { rightArm: [-80, 0, 0], leftArm: [50, 0, 0], rightLeg: [47, 0, 0], leftLeg: [-70, 0, 0], body: [8, 0, 0] },
    camera: { yaw: 34 }
  },
  {
    id: 'crouching',
    parts: { body: [26, 0, 0], head: [-44, 0, 0], rightArm: [-10, 0, 0], leftArm: [-10, 0, 0], rightLeg: [-40, 0, 6], leftLeg: [-40, 0, -6] },
    camera: { target: [0, 14, 0], distance: 62 }
  },
  {
    id: 'sitting',
    parts: {
      body: [-25, 0, 0], head: [-5, 0, 0], 
      rightLeg: [-70, -5, 0], leftLeg: [-70, 5, 0],
      rightShin: [0, 0, 0], leftShin: [0, 0, 0],
      rightArm: [45, -10, -5], leftArm: [45, 10, 5],
      rightForearm: [-24, 0, 0], leftForearm: [-24, 0, 0]
    },
    camera: { target: [0, 12, 0], distance: 64 }
  },
  {
    id: 'sleeping',
    parts: { head: [0, 0, 0] },
    camera: { yaw: 20, pitch: 62, distance: 74, target: [0, 8, 0] }
  },
  {
    id: 'cheering',
    parts: { rightArm: [-160, 0, 14], leftArm: [-160, 0, -14] },
    camera: { target: [0, 19, 0] }
  },
  {
    id: 'waving',
    parts: { leftArm: [-150, 0, -18], rightArm: [6, 0, 0], head: [0, -14, 0] },
    camera: {}
  },
  {
    id: 'pointing',
    parts: { rightArm: [-96, 0, 0], leftArm: [8, 0, 0], head: [-8, -10, 0] },
    camera: { yaw: 38 }
  },
  {
    id: 'crossed',
    parts: { rightArm: [-24, 0, 46], leftArm: [-24, 0, -46] },
    camera: {}
  },
  {
    id: 'lunging',
    parts: { rightArm: [-132, 0, 0], leftArm: [12, 0, 0], rightLeg: [-56, 0, 0], leftLeg: [26, 0, 0], body: [14, 0, 0] },
    camera: { yaw: 40, target: [0, 16, 0] }
  },
  {
    id: 'kicking',
    parts: { rightLeg: [-88, 0, 0], leftArm: [-26, 0, 0], rightArm: [30, 0, 0], body: [-8, 0, 0] },
    camera: { yaw: 46 }
  },
  {
    id: 'archer',
    parts: { rightArm: [-92, 0, 0], leftArm: [-88, 0, 24], head: [0, -22, 0] },
    camera: { yaw: 52 }
  },
  {
    id: 'facepalm',
    parts: { rightArm: [-115, 0, -35], rightForearm: [-40, 0, 0], head: [16, 0, 0], leftArm: [10, 0, 0] },
    camera: { yaw: 24 }
  },
  {
    id: 'dead',
    parts: { rightArm: [0, 0, -34], leftArm: [0, 0, 34] },
    camera: { yaw: 16, pitch: 78, distance: 76, target: [0, 6, 0] }
  },
  {
    id: 'floating',
    parts: { rightArm: [-40, 0, -22], leftArm: [-40, 0, 22], rightLeg: [-22, 0, 8], leftLeg: [-14, 0, -8] },
    camera: { pitch: 20, target: [0, 18, 0] }
  },
  {
    id: 'looking',
    parts: { head: [-26, -24, 0] },
    camera: { yaw: 22, pitch: 4 }
  },
  {
    id: 'relaxing',
    parts: {
      rightArm: [-2, 0, -32], leftArm: [-2, 0, 32],
      rightLeg: [-54, 0, 0], leftLeg: [-54, 0, 0],
      rightShin: [40, 0, 0], leftShin: [40, 0, 0],
      body: [-16, 0, 0]
    },
    camera: { target: [0, 13, 0], distance: 66 }
  },
  {
    id: 'marching',
    parts: { rightArm: [-58, 0, 0], leftArm: [58, 0, 0], rightLeg: [46, 0, 0], leftLeg: [-46, 0, 0] },
    camera: { yaw: 24 }
  },
  {
    id: 'hero',
    parts: {
      head: [-10, 0, 0],
      rightArm: [50, 90, 0], leftArm: [50, -90, 0],
      rightForearm: [-90, 0, 0], leftForearm: [-90, 0, 0],
      rightLeg: [0, 0, -6], leftLeg: [0, 0, 6]
    },
    offsets: { rightArm: [-1, 0, -1], leftArm: [1, 0, -1] },
    camera: { yaw: 22, target: [0, 18, 0] }
  },
  {
    id: 'flexing',
    parts: {
      rightArm: [-95, -105, 0], leftArm: [-95, 105, 0],
      rightForearm: [-80, 0, 0], leftForearm: [-80, 0, 0],
      head: [0, -10, 0]
    },
    camera: { yaw: 16, target: [0, 20, 0] }
  },
  {
    id: 'thinking',
    parts: {
      rightArm: [-10, -34, -20], rightForearm: [-124, 0, 0],
      leftArm: [-14, 0, 26], leftForearm: [-38, 0, 0],
      head: [12, -12, 0]
    },
    camera: { yaw: 30, target: [0, 20, 0] }
  },
  {
    id: 'kneeling',
    parts: {
      rightLeg: [-112, 0, 0], rightShin: [116, 0, 0],
      leftLeg: [-38, 0, 0], leftShin: [76, 0, 0],
      rightArm: [-34, 0, 0], rightForearm: [-40, 0, 0],
      leftArm: [2, 0, 0], body: [10, 0, 0]
    },
    camera: { yaw: 34, target: [0, 11, 0] }
  },
  {
    id: 'climbing',
    parts: {
      rightArm: [-158, 0, 12], rightForearm: [-46, 0, 0],
      leftArm: [-96, 0, 10], leftForearm: [-58, 0, 0],
      rightLeg: [-58, 0, 8], rightShin: [72, 0, 0],
      leftLeg: [-12, 0, -6], leftShin: [26, 0, 0]
    },
    camera: { yaw: 28, target: [0, 18, 0] }
  },
  {
    id: 'spiderman',
    parts: {
      body: [20, 0, 0], head: [-25, 0, 0],
      rightArm: [-145, 10, 45], rightForearm: [0, 0, 0],
      leftArm: [20, 30, 60], leftForearm: [-30, 0, 0],
      rightLeg: [25, -15, 5], rightShin: [35, 0, 0],
      leftLeg: [5, -10, 0], leftShin: [45, 0, 0]
    },
    camera: { yaw: 28, target: [0, 18, 0] }
  },
  {
    id: 'trudging',
    parts: { body: [18, 0, 0], head: [-32, 0, 0], rightArm: [-34, 0, 0], leftArm: [-6, 0, 0], rightLeg: [6, 0, 0], leftLeg: [-36, 0, 0] },
    camera: {}
  },
  {
    id: 'lookat',
    parts: {
      body: [0, -10, 0], head: [-10, 35, -4],
      rightArm: [-5, 0, 0], rightForearm: [0, 0, 0],
      leftArm: [5, 0, 0], leftForearm: [0, 0, 0],
      rightLeg: [-5, 0, 0], rightShin: [0, 0, 0],
      leftLeg: [5, 0, 0], leftShin: [0, 0, 0]
    },
    camera: { yaw: 28, target: [0, 18, 0] }
  },
]

export const poseById = (id: string) => POSES.find(p => p.id === id)

export const isRenderCrop = (value: string): value is RenderCrop =>
  (RENDER_CROPS as string[]).includes(value)

export const LIMB_SEGMENTS: Record<string, { lower: string, joint: number }> = {
  rightArm: { lower: 'rightForearm', joint: 18 },
  leftArm: { lower: 'leftForearm', joint: 18 },
  rightLeg: { lower: 'rightShin', joint: 6 },
  leftLeg: { lower: 'leftShin', joint: 6 }
}

export const BENDABLE = Object.keys(LIMB_SEGMENTS)

export interface Mitre {
  sign: number
  normal: PoseVec
}

const RAD = Math.PI / 180

const spin = (p: PoseVec, r: PoseVec): PoseVec => {
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

const unspin = (p: PoseVec, r: PoseVec): PoseVec => {
  const [rx, ry, rz] = [-r[0] * RAD, -r[1] * RAD, -r[2] * RAD]
  let [x, y, z] = p
  const cy = Math.cos(ry), sy = Math.sin(ry)
  ;[x, z] = [x * cy + z * sy, -x * sy + z * cy]
  const cz = Math.cos(rz), sz = Math.sin(rz)
  ;[x, y] = [x * cz - y * sz, x * sz + y * cz]
  const cx = Math.cos(rx), sx = Math.sin(rx)
  ;[y, z] = [y * cx - z * sx, y * sx + z * cx]
  return [x, y, z]
}

export function mitreFor(bend: PoseVec, sign: number): Mitre {
  const axis: PoseVec = [0, 1, 0]
  const turned = spin(axis, bend)
  const sum: PoseVec = [turned[0], axis[1] + turned[1], turned[2]]

  const length = Math.hypot(sum[0], sum[1], sum[2]) || 1
  const normal: PoseVec = [sum[0] / length, sum[1] / length, sum[2] / length]

  return { sign, normal: sign < 0 ? normal : unspin(normal, bend) }
}

export function mitreOffset(mitre: Mitre, dx: number, dz: number): number {
  const [nx, ny, nz] = mitre.normal
  if (Math.abs(ny) < 1e-6) return 0
  return -(nx * dx + nz * dz) / ny
}

export interface Joint {
  pivot: PoseVec
  rotation: PoseVec
  offset?: PoseVec
}

export interface PosedPart {
  id: string
  part: PartSpec
  size: PoseVec
  centre: PoseVec
  joints: Joint[]
  overlay: boolean
  segment?: { fromTop: number, height: number }
  mitre?: Mitre
}

export function posedParts(pose: Pose, model: SkinModel, overlay: boolean): PosedPart[] {
  const out: PosedPart[] = []

  const moves = pose.offsets ?? {}
  const tilt = (pose.parts.body ?? [0, 0, 0]) as PoseVec
  const tilted = tilt[0] !== 0 || tilt[1] !== 0 || tilt[2] !== 0
  const torso: Joint[] = tilted || moves.body
    ? [{ pivot: PIVOTS.body!, rotation: tilt, offset: moves.body as PoseVec | undefined }]
    : []

  const push = (entry: Omit<PosedPart, 'overlay'>) => {
    out.push({ ...entry, overlay: false })
    if (overlay && entry.part.overlayUv) out.push({ ...entry, overlay: true })
  }

  for (const part of PARTS) {
    const width = model === 'slim' && part.slimWidth ? part.slimWidth : part.size[0]
    const shift = part.size[0] - width
    const [x, y, z] = part.position
    const nudge = part.id === 'rightArm' ? shift / 2 : part.id === 'leftArm' ? -shift / 2 : 0

    const centre: PoseVec = [x + nudge, y, z]
    const base = PIVOTS[part.id] ?? [0, 0, 0]
    const pivot: PoseVec = [base[0] + nudge, base[1], base[2]]
    const rotation = (pose.parts[part.id] ?? [0, 0, 0]) as PoseVec
    const size: PoseVec = [width, part.size[1], part.size[2]]

    const move = moves[part.id] as PoseVec | undefined
    const parent = part.id === 'body' ? [] : torso

    const split = LIMB_SEGMENTS[part.id]
    const raw = split ? (pose.parts[split.lower] ?? [0, 0, 0]) as PoseVec : null
    const bend: PoseVec | null = raw ? [raw[0], 0, 0] : null
    const bent = bend && bend[0] !== 0

    if (!split || !bent) {
      push({ id: part.id, part, size, centre, joints: [{ pivot, rotation, offset: move }, ...parent] })
      continue
    }

    const half = part.size[1] / 2
    const top = part.position[1] + half
    const knee: PoseVec = [centre[0], split.joint, centre[2]]

    push({
      id: part.id,
      part,
      size: [width, half, part.size[2]],
      centre: [centre[0], top - half / 2, centre[2]],
      joints: [{ pivot, rotation, offset: move }, ...parent],
      segment: { fromTop: 0, height: half },
      mitre: mitreFor(bend, -1)
    })

    push({
      id: split.lower,
      part,
      size: [width, half, part.size[2]],
      centre: [centre[0], split.joint - half / 2, centre[2]],
      joints: [
        { pivot: knee, rotation: bend, offset: moves[split.lower] as PoseVec | undefined },
        { pivot, rotation, offset: move },
        ...parent
      ],
      segment: { fromTop: half, height: half },
      mitre: mitreFor(bend, 1)
    })
  }

  return out
}
