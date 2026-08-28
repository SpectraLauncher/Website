<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = defineProps<{ state: DisplayState }>()

const MC_PX = 0.025
const SS = 4
const LINE_H = 10
const GLYPH_PX = 8.75
const ASCENT = 7
const ORIGIN = 0x34d399

const BLOCK_TINTS: [string, string][] = [
  ['dark_oak', '#4F3218'], ['deepslate', '#4F4F52'], ['blackstone', '#2B252B'],
  ['diamond', '#4AEDD9'], ['emerald', '#17DD62'], ['netherite', '#4D4646'],
  ['amethyst', '#9A73CE'], ['prismarine', '#5F9E92'], ['glowstone', '#F9D49C'],
  ['sea_lantern', '#B6D0C7'], ['redstone', '#D22B15'], ['terracotta', '#985F44'],
  ['obsidian', '#15101F'], ['concrete', '#8C8C8C'], ['quartz', '#EDE9E2'],
  ['bamboo', '#C8B550'], ['cherry', '#E3A5B0'], ['spruce', '#785A34'],
  ['birch', '#D7C185'], ['copper', '#E77C56'], ['nether', '#8A3B3B'],
  ['lapis', '#1D47A5'], ['gold', '#F8D33C'], ['iron', '#D8D8D8'],
  ['coal', '#191919'], ['slime', '#7FCC5A'], ['honey', '#E8A33D'],
  ['grass', '#7FB238'], ['dirt', '#976D4D'], ['sand', '#DBD3A0'],
  ['glass', '#B4DCE2'], ['ice', '#96B4F0'], ['wool', '#E9ECEC'],
  ['brick', '#8F4B3B'], ['planks', '#B08B50'], ['oak', '#B08B50'],
  ['log', '#9A7A4B'], ['end', '#DCE1A0'], ['stone', '#7D7D7D']
]

const tintFor = (id: string) => BLOCK_TINTS.find(([k]) => id.includes(k))?.[1] || '#8C8C8C'

interface Run {
  text: string
  color: string
  bold: boolean
  italic: boolean
  underlined: boolean
  strikethrough: boolean
}

const host = ref<HTMLElement>()
const ready = ref(false)

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let billboard: THREE.Group | undefined
let pivot: THREE.Group | undefined
let content: THREE.Object3D | undefined
let frame = 0

const fontFor = (bold: boolean, italic: boolean) =>
  `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${GLYPH_PX * SS}px Monocraft, monospace`

const runsFromSegments = (): Run[][] => {
  const lines: Run[][] = [[]]

  for (const s of props.state.segments) {
    if (!s.text) continue
    s.text.split('\n').forEach((piece, i) => {
      if (i > 0) lines.push([])
      if (!piece) return
      lines[lines.length - 1]!.push({
        text: piece,
        color: mcColorHex(s.color),
        bold: s.bold,
        italic: s.italic,
        underlined: s.underlined,
        strikethrough: s.strikethrough
      })
    })
  }

  return lines
}

const runWidth = (ctx: CanvasRenderingContext2D, run: Run) => {
  ctx.font = fontFor(run.bold, run.italic)
  return ctx.measureText(run.text).width / SS
}

function wrapLines(lines: Run[][], maxWidth: number, ctx: CanvasRenderingContext2D): Run[][] {
  const out: Run[][] = []

  for (const line of lines) {
    let current: Run[] = []
    let width = 0

    for (const run of line) {
      ctx.font = fontFor(run.bold, run.italic)
      let buffer = ''

      for (const word of run.text.split(/(\s+)/)) {
        if (!word) continue
        const w = ctx.measureText(word).width / SS

        if (width + w > maxWidth && (buffer || current.length)) {
          if (buffer) current.push({ ...run, text: buffer })
          out.push(current)
          current = []
          buffer = ''
          width = 0
          if (/^\s+$/.test(word)) continue
        }

        buffer += word
        width += w
      }

      if (buffer) current.push({ ...run, text: buffer })
    }

    out.push(current)
  }

  return out.length ? out : [[]]
}

const shade = (hex: string) => {
  const n = fromHex(hex)
  const { r, g, b } = toRgb(n)
  return `rgb(${r >> 2},${g >> 2},${b >> 2})`
}

function buildTextMesh(): THREE.Object3D {
  const s = props.state
  const probe = document.createElement('canvas').getContext('2d')!
  const lines = wrapLines(runsFromSegments(), Math.max(20, s.lineWidth), probe)
  const widths = lines.map(line => line.reduce((acc, run) => acc + runWidth(probe, run), 0))
  const textWidth = Math.max(1, ...widths)

  const wMc = textWidth + 2
  const hMc = lines.length * LINE_H

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(wMc * SS)
  canvas.height = Math.ceil(hMc * SS)
  const ctx = canvas.getContext('2d')!

  const alpha = s.defaultBackground ? 0.25 : (s.bgAlpha < MIN_VISIBLE_OPACITY ? 0 : s.bgAlpha / 255)
  if (alpha > 0) {
    const { r, g, b } = toRgb(s.defaultBackground ? 0 : fromHex(s.bgColor))
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  ctx.textBaseline = 'alphabetic'
  ctx.globalAlpha = s.textOpacity <= 3 ? 1 : s.textOpacity / 255

  lines.forEach((line, i) => {
    const lineWidth = widths[i] || 0
    const startX = s.align === 'left'
      ? 1
      : s.align === 'right'
        ? wMc - 1 - lineWidth
        : (wMc - lineWidth) / 2
    const baseline = i * LINE_H + ASCENT

    const paint = (offset: number, shadowPass: boolean) => {
      let x = startX + offset
      for (const run of line) {
        ctx.font = fontFor(run.bold, run.italic)
        ctx.fillStyle = shadowPass ? shade(run.color) : run.color
        ctx.fillText(run.text, x * SS, (baseline + offset) * SS)
        const w = ctx.measureText(run.text).width / SS
        if (!shadowPass && run.underlined) ctx.fillRect(x * SS, (baseline + 1) * SS, w * SS, SS)
        if (!shadowPass && run.strikethrough) ctx.fillRect(x * SS, (baseline - 3) * SS, w * SS, SS)
        x += w
      }
    }

    if (s.shadow) paint(1, true)
    paint(0, false)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.colorSpace = THREE.SRGBColorSpace

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(wMc * MC_PX, hMc * MC_PX),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: !s.seeThrough,
      depthWrite: false
    })
  )
  mesh.renderOrder = s.seeThrough ? 5 : 1
  return mesh
}

function labelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 4
  ctx.setLineDash([12, 10])
  ctx.strokeRect(6, 6, 244, 244)

  ctx.setLineDash([])
  ctx.fillStyle = '#e4e4e7'
  ctx.font = '26px Monocraft, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const words = text.split('_')
  words.forEach((word, i) => {
    ctx.fillText(word, 128, 128 + (i - (words.length - 1) / 2) * 32)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function buildBlockMesh(): THREE.Object3D {
  const group = new THREE.Group()
  const color = new THREE.Color(tintFor(props.state.blockId.toLowerCase()))

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color })
  )
  cube.position.set(0.5, 0.5, 0.5)
  group.add(cube)

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(0.35) })
  )
  edges.position.copy(cube.position)
  group.add(edges)

  return group
}

function buildItemMesh(): THREE.Object3D {
  const texture = labelTexture(props.state.itemId.toLowerCase() || 'item')
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
  )
}

const disposeContent = () => {
  if (!content) return
  pivot?.remove(content)
  content.traverse((node) => {
    const mesh = node as THREE.Mesh
    mesh.geometry?.dispose()
    const material = mesh.material as THREE.Material & { map?: THREE.Texture }
    if (material) {
      material.map?.dispose()
      material.dispose()
    }
  })
  content = undefined
}

function applyTransform() {
  if (!pivot) return
  const s = props.state

  const left = quatFromEuler(s.left)
  const right = quatFromEuler(s.right)

  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(s.translation.x, s.translation.y, s.translation.z),
    new THREE.Quaternion(left[0], left[1], left[2], left[3]),
    new THREE.Vector3(s.scale.x || MIN_SCALE, s.scale.y || MIN_SCALE, s.scale.z || MIN_SCALE)
  )

  matrix.multiply(new THREE.Matrix4().makeRotationFromQuaternion(
    new THREE.Quaternion(right[0], right[1], right[2], right[3])
  ))

  pivot.matrixAutoUpdate = false
  pivot.matrix.copy(matrix)
  pivot.matrixWorldNeedsUpdate = true
}

function build() {
  if (!pivot) return
  disposeContent()

  content = props.state.kind === 'text'
    ? buildTextMesh()
    : props.state.kind === 'block'
      ? buildBlockMesh()
      : buildItemMesh()

  pivot.add(content)
  applyTransform()
}

function updateBillboard() {
  if (!billboard || !camera) return
  const mode = props.state.billboard

  if (mode === 'fixed') {
    billboard.quaternion.identity()
    return
  }

  const dir = camera.position.clone()
  const yaw = Math.atan2(dir.x, dir.z)
  const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z))

  const euler = new THREE.Euler(
    mode === 'vertical' ? 0 : -pitch,
    mode === 'horizontal' ? 0 : yaw,
    0,
    'YXZ'
  )
  billboard.quaternion.setFromEuler(euler)
}

function resetView() {
  if (!camera || !controls) return
  camera.position.set(3.2, 2.4, 3.2)
  controls.target.set(0, 0.5, 0)
  controls.update()
}


let observer: ResizeObserver | undefined

function init(el: HTMLElement) {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.05, 500)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0xffffff, 1.5))
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(1, 1.5, 0.9)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x88aaff, 0.45)
  fill.position.set(-1, -0.5, -0.9)
  scene.add(fill)

  const grid = new THREE.GridHelper(16, 16, 0x52525b, 0x27272a)
  grid.position.y = -0.001
  scene.add(grid)

  const markerMaterial = new THREE.LineBasicMaterial({ color: ORIGIN, depthTest: false, transparent: true })
  const marker = new THREE.Group()
  marker.renderOrder = 20
  for (const axis of [[0.45, 0, 0], [0, 0.45, 0], [0, 0, 0.45]]) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-axis[0]!, -axis[1]!, -axis[2]!),
      new THREE.Vector3(axis[0]!, axis[1]!, axis[2]!)
    ])
    marker.add(new THREE.Line(geometry, markerMaterial))
  }
  marker.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 12),
    new THREE.MeshBasicMaterial({ color: ORIGIN, depthTest: false, transparent: true })
  ))
  scene.add(marker)

  billboard = new THREE.Group()
  pivot = new THREE.Group()
  billboard.add(pivot)
  scene.add(billboard)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  resetView()

  build()
  ready.value = true

  const loop = () => {
    frame = requestAnimationFrame(loop)
    controls?.update()
    updateBillboard()
    if (renderer && scene && camera) renderer.render(scene, camera)
  }
  loop()

  observer = new ResizeObserver(() => {
    if (!renderer || !camera || !el.clientWidth) return
    camera.aspect = el.clientWidth / el.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(el.clientWidth, el.clientHeight)
  })
  observer.observe(el)

  if (document.fonts?.load) {
    Promise.all([
      document.fonts.load(`${GLYPH_PX * SS}px Monocraft`),
      document.fonts.load(`bold ${GLYPH_PX * SS}px Monocraft`)
    ]).then(() => build()).catch(() => undefined)
  }
}

watch(host, (el) => {
  if (!el || renderer) return
  init(el)
}, { immediate: true, flush: 'post' })

onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
  controls?.dispose()
  disposeContent()
  renderer?.dispose()
  renderer?.domElement.remove()
  renderer = undefined
})

const contentKey = computed(() => JSON.stringify([
  props.state.kind,
  props.state.segments,
  props.state.lineWidth,
  props.state.textOpacity,
  props.state.bgColor,
  props.state.bgAlpha,
  props.state.defaultBackground,
  props.state.shadow,
  props.state.seeThrough,
  props.state.align,
  props.state.blockId,
  props.state.itemId
]))

watch(contentKey, build)

watch(
  () => [props.state.translation, props.state.scale, props.state.left, props.state.right],
  applyTransform,
  { deep: true }
)

defineExpose({ resetView })
</script>

<template>
  <div class="relative">
    <div ref="host" class="h-[440px] w-full rounded-2xl bg-[#0b0b0e]" />
    <UButton
      icon="i-lucide-focus"
      size="xs"
      variant="ghost"
      color="neutral"
      class="absolute right-3 top-3"
      :label="$t('display.resetView')"
      @click="resetView"
    />
    <p v-if="!ready" class="absolute inset-0 grid place-items-center text-sm text-muted">
      {{ $t('display.loadingPreview') }}
    </p>
  </div>
</template>
