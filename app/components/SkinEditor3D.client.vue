<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  PARTS, SKIN_SIZE, OVERLAY_INFLATE, boxFaces, partGeometry,
  type SkinModel, type UvRect
} from '~/utils/skin'
import { texelFromUv } from '~/utils/skinEdit'

const props = defineProps<{
  source: HTMLCanvasElement | null
  version: number
  model: SkinModel
  grid: boolean
  showBase: boolean
  showOverlay: boolean
}>()

const emit = defineEmits<{
  begin: []
  paint: [x: number, y: number]
  end: []
}>()

const host = ref<HTMLElement>()

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let player: THREE.Group | undefined
let texture: THREE.CanvasTexture | undefined
let gridTexture: THREE.CanvasTexture | undefined
let observer: ResizeObserver | undefined
let frame = 0
let painting = false

const base: THREE.Mesh[] = []
const outer: THREE.Mesh[] = []
const gridMeshes: THREE.Mesh[] = []
const targets: THREE.Mesh[] = []

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

const applyUv = (geometry: THREE.BoxGeometry, faces: UvRect[]) => {
  const uv = geometry.attributes.uv as THREE.BufferAttribute

  faces.forEach((rect, i) => {
    const u0 = rect.x / SKIN_SIZE
    const u1 = (rect.x + rect.w) / SKIN_SIZE
    const top = 1 - rect.y / SKIN_SIZE
    const bottom = 1 - (rect.y + rect.h) / SKIN_SIZE
    const v0 = rect.flipV ? bottom : top
    const v1 = rect.flipV ? top : bottom

    uv.setXY(i * 4 + 0, u0, v0)
    uv.setXY(i * 4 + 1, u1, v0)
    uv.setXY(i * 4 + 2, u0, v1)
    uv.setXY(i * 4 + 3, u1, v1)
  })

  uv.needsUpdate = true
}

function buildGridTexture() {
  const cell = 8
  const canvas = document.createElement('canvas')
  canvas.width = SKIN_SIZE * cell
  canvas.height = SKIN_SIZE * cell

  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i <= SKIN_SIZE; i++) {
    ctx.moveTo(i * cell + 0.5, 0)
    ctx.lineTo(i * cell + 0.5, canvas.height)
    ctx.moveTo(0, i * cell + 0.5)
    ctx.lineTo(canvas.width, i * cell + 0.5)
  }
  ctx.stroke()

  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  return tex
}

const disposeGroup = (group: THREE.Object3D | undefined) => {
  if (!group) return
  group.traverse((node) => {
    const mesh = node as THREE.Mesh
    mesh.geometry?.dispose()
    const material = mesh.material as THREE.Material | undefined
    material?.dispose()
  })
  group.parent?.remove(group)
}

function buildPlayer() {
  if (!scene || !props.source) return

  disposeGroup(player)
  base.length = 0
  outer.length = 0
  gridMeshes.length = 0
  targets.length = 0

  texture?.dispose()
  texture = new THREE.CanvasTexture(props.source)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace

  gridTexture ??= buildGridTexture()

  player = new THREE.Group()

  const gridMaterial = () => new THREE.MeshBasicMaterial({
    map: gridTexture,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  })

  for (const part of PARTS) {
    const { size, position } = partGeometry(part, props.model)
    const [w, h, d] = size

    const inner = new THREE.BoxGeometry(w, h, d)
    applyUv(inner, boxFaces(part.uv[0]!, part.uv[1]!, w, h, d))

    const mesh = new THREE.Mesh(inner, new THREE.MeshBasicMaterial({ map: texture }))
    mesh.position.set(position[0], position[1], position[2])
    player.add(mesh)
    base.push(mesh)
    targets.push(mesh)

    const innerGrid = new THREE.Mesh(inner, gridMaterial())
    innerGrid.position.copy(mesh.position)
    player.add(innerGrid)
    gridMeshes.push(innerGrid)

    if (!part.overlayUv) continue

    const shell = new THREE.BoxGeometry(w + OVERLAY_INFLATE, h + OVERLAY_INFLATE, d + OVERLAY_INFLATE)
    applyUv(shell, boxFaces(part.overlayUv[0]!, part.overlayUv[1]!, w, h, d))

    const shellMesh = new THREE.Mesh(shell, new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide
    }))
    shellMesh.position.copy(mesh.position)
    player.add(shellMesh)
    outer.push(shellMesh)
    targets.unshift(shellMesh)

    const shellGrid = new THREE.Mesh(shell, gridMaterial())
    shellGrid.position.copy(mesh.position)
    player.add(shellGrid)
    gridMeshes.push(shellGrid)
  }

  scene.add(player)
  applyVisibility()
}

function applyVisibility() {
  for (const mesh of base) mesh.visible = props.showBase
  for (const mesh of outer) mesh.visible = props.showOverlay
  for (const mesh of gridMeshes) {
    const isShell = outer.some(o => o.geometry === mesh.geometry)
    mesh.visible = props.grid && (isShell ? props.showOverlay : props.showBase)
  }
}

const hit = (event: PointerEvent): [number, number] | null => {
  const el = renderer?.domElement
  if (!el || !camera) return null

  const box = el.getBoundingClientRect()
  pointer.x = ((event.clientX - box.left) / box.width) * 2 - 1
  pointer.y = -((event.clientY - box.top) / box.height) * 2 + 1

  raycaster.setFromCamera(pointer, camera)
  const list = targets.filter(m => m.visible)
  const found = raycaster.intersectObjects(list, false)[0]
  if (!found?.uv) return null

  return texelFromUv(found.uv.x, found.uv.y)
}

function down(event: PointerEvent) {
  const texel = hit(event)
  if (!texel) return

  painting = true
  if (controls) controls.enabled = false
  ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
  emit('begin')
  emit('paint', texel[0], texel[1])
}

function move(event: PointerEvent) {
  if (!painting) return
  const texel = hit(event)
  if (texel) emit('paint', texel[0], texel[1])
}

function up() {
  if (!painting) return
  painting = false
  if (controls) controls.enabled = true
  emit('end')
}

function init(el: HTMLElement) {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, el.clientWidth / Math.max(1, el.clientHeight), 0.1, 500)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 24
  controls.maxDistance = 120
  camera.position.set(0, 20, 52)
  controls.target.set(0, 16, 0)
  controls.update()

  buildPlayer()

  renderer.domElement.addEventListener('pointerdown', down)
  renderer.domElement.addEventListener('pointermove', move)
  renderer.domElement.addEventListener('pointerup', up)
  renderer.domElement.addEventListener('pointercancel', up)

  const loop = () => {
    frame = requestAnimationFrame(loop)
    controls?.update()
    if (renderer && scene && camera) renderer.render(scene, camera)
  }
  loop()

  observer = new ResizeObserver(() => {
    if (!renderer || !camera || !el.clientWidth) return
    camera.aspect = el.clientWidth / Math.max(1, el.clientHeight)
    camera.updateProjectionMatrix()
    renderer.setSize(el.clientWidth, el.clientHeight)
  })
  observer.observe(el)
}

watch(host, (el) => {
  if (!el || renderer) return
  init(el)
}, { immediate: true, flush: 'post' })

watch(() => props.version, () => {
  if (texture) texture.needsUpdate = true
})

watch(() => [props.model, props.source], buildPlayer)
watch(() => [props.grid, props.showBase, props.showOverlay], applyVisibility)

onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
  controls?.dispose()
  disposeGroup(player)
  texture?.dispose()
  gridTexture?.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
  renderer = undefined
})
</script>

<template>
  <div ref="host" class="size-full touch-none rounded-2xl bg-[#0b0f16]" />
</template>
