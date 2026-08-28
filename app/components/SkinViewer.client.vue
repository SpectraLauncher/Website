<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  PARTS, SKIN_SIZE, OVERLAY_INFLATE, boxFaces, capeFaces, capeScale, partGeometry,
  type SkinModel, type UvRect
} from '~/utils/skin'
import { PIVOTS } from '~/utils/skinPose'

const props = withDefaults(defineProps<{
  skin: HTMLCanvasElement | null
  model: SkinModel
  cape?: HTMLCanvasElement | null
  spin?: boolean
  parts?: string[] | null
  animation?: SkinAnimation
  yaw?: number
}>(), { cape: null, spin: true, parts: null, animation: 'none', yaw: 0 })

const host = ref<HTMLElement>()

const joints: Record<string, THREE.Group> = {}
let torso: THREE.Group | undefined
let started = 0

const PUNCH_MS = 340
let punchUntil = 0

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let downOn: { x: number, y: number } | null = null

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let player: THREE.Group | undefined
let capeMesh: THREE.Object3D | undefined
let skinTexture: THREE.CanvasTexture | undefined
let capeTexture: THREE.CanvasTexture | undefined
let observer: ResizeObserver | undefined
let frame = 0

const pixelTexture = (source: HTMLCanvasElement) => {
  const texture = new THREE.CanvasTexture(source)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const applyUv = (geometry: THREE.BoxGeometry, faces: UvRect[], texW: number, texH: number) => {
  const uv = geometry.attributes.uv as THREE.BufferAttribute

  faces.forEach((rect, i) => {
    const u0 = rect.x / texW
    const u1 = (rect.x + rect.w) / texW
    const top = 1 - rect.y / texH
    const bottom = 1 - (rect.y + rect.h) / texH
    const v0 = rect.flipV ? bottom : top
    const v1 = rect.flipV ? top : bottom

    uv.setXY(i * 4 + 0, u0, v0)
    uv.setXY(i * 4 + 1, u1, v0)
    uv.setXY(i * 4 + 2, u0, v1)
    uv.setXY(i * 4 + 3, u1, v1)
  })

  uv.needsUpdate = true
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
  if (!scene || !props.skin) return

  disposeGroup(player)
  skinTexture?.dispose()
  skinTexture = pixelTexture(props.skin)

  player = new THREE.Group()

  for (const key of Object.keys(joints)) delete joints[key]

  const HIP: [number, number, number] = [0, 12, 0]
  torso = new THREE.Group()
  torso.position.set(HIP[0], HIP[1], HIP[2])
  player.add(torso)

  const visible = props.parts ? PARTS.filter(p => props.parts!.includes(p.id)) : PARTS

  for (const part of visible) {
    const { size, position } = partGeometry(part, props.model)
    const [w, h, d] = size

    const pivot = PIVOTS[part.id] ?? [0, 0, 0]
    const onTorso = part.id !== 'rightLeg' && part.id !== 'leftLeg'
    const parent = onTorso ? torso : player

    const group = new THREE.Group()
    group.position.set(
      pivot[0] - (onTorso ? HIP[0] : 0),
      pivot[1] - (onTorso ? HIP[1] : 0),
      pivot[2] - (onTorso ? HIP[2] : 0)
    )
    parent.add(group)
    joints[part.id] = group

    const local = new THREE.Vector3(position[0] - pivot[0], position[1] - pivot[1], position[2] - pivot[2])

    const base = new THREE.BoxGeometry(w, h, d)
    applyUv(base, boxFaces(part.uv[0]!, part.uv[1]!, w, h, d), SKIN_SIZE, SKIN_SIZE)
    const mesh = new THREE.Mesh(base, new THREE.MeshBasicMaterial({ map: skinTexture }))
    mesh.position.copy(local)
    group.add(mesh)

    if (!part.overlayUv) continue

    const outer = new THREE.BoxGeometry(w + OVERLAY_INFLATE, h + OVERLAY_INFLATE, d + OVERLAY_INFLATE)
    applyUv(outer, boxFaces(part.overlayUv[0]!, part.overlayUv[1]!, w, h, d), SKIN_SIZE, SKIN_SIZE)
    const outerMesh = new THREE.Mesh(outer, new THREE.MeshBasicMaterial({
      map: skinTexture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide
    }))
    outerMesh.position.copy(local)
    group.add(outerMesh)
  }

  player.rotation.y = props.yaw * Math.PI / 180

  scene.add(player)
  buildCape()
}

function buildCape() {
  if (!player) return

  disposeGroup(capeMesh)
  capeMesh = undefined
  capeTexture?.dispose()
  capeTexture = undefined

  if (!props.cape) return

  capeTexture = pixelTexture(props.cape)

  const geometry = new THREE.BoxGeometry(10, 16, 1)
  applyUv(geometry, capeFaces(capeScale(props.cape.width, props.cape.height)), props.cape.width, props.cape.height)

  const pivot = new THREE.Group()
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: capeTexture }))
  mesh.position.set(0, -8, -0.5)
  pivot.add(mesh)
  pivot.position.set(0, 24, -2)
  pivot.rotation.x = 0.18

  capeMesh = pivot
  pivot.position.set(0, 24 - 12, -2)
  ;(torso ?? player).add(pivot)
}

const RAD = Math.PI / 180

function animate(time: number) {
  if (!player || !torso) return

  const rest = () => {
    torso!.rotation.set(0, 0, 0)
    player!.position.y = 0
    for (const group of Object.values(joints)) group.rotation.set(0, 0, 0)
  }

  if (props.animation === 'walk') {
    rest()
    const swing = Math.sin(time * 5.2) * 0.75

    if (joints.rightArm) joints.rightArm.rotation.x = swing
    if (joints.leftArm) joints.leftArm.rotation.x = -swing
    if (joints.rightLeg) joints.rightLeg.rotation.x = -swing
    if (joints.leftLeg) joints.leftLeg.rotation.x = swing
    if (joints.head) joints.head.rotation.y = Math.sin(time * 1.3) * 0.12
    return
  }

  if (props.animation === 'crouch') {
    rest()
    torso.rotation.x = 26 * RAD
    player.position.y = -2

    if (joints.head) joints.head.rotation.x = -18 * RAD
    if (joints.rightArm) joints.rightArm.rotation.x = -8 * RAD
    if (joints.leftArm) joints.leftArm.rotation.x = -8 * RAD
    if (joints.rightLeg) joints.rightLeg.rotation.x = -14 * RAD
    if (joints.leftLeg) joints.leftLeg.rotation.x = -14 * RAD
    return
  }

  rest()
  const idle = Math.sin(time * 1.6) * 0.04
  if (joints.rightArm) joints.rightArm.rotation.z = -idle
  if (joints.leftArm) joints.leftArm.rotation.z = idle
}

function applyPunch() {
  const left = punchUntil - performance.now()
  if (left <= 0) return

  const progress = 1 - left / PUNCH_MS
  const arc = Math.sin(progress * Math.PI)

  if (joints.rightArm) {
    joints.rightArm.rotation.x -= arc * 1.7
    joints.rightArm.rotation.z -= arc * 0.25
  }
  if (torso) torso.rotation.y -= arc * 0.14
}

function frameCamera() {
  if (!camera || !controls) return
  const headOnly = props.parts?.length === 1 && props.parts[0] === 'head'
  camera.position.set(0, headOnly ? 29 : 20, headOnly ? 22 : 52)
  controls.target.set(0, headOnly ? 28 : 16, 0)
  controls.update()
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
  frameCamera()

  buildPlayer()

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop)
    if (!started) started = now

    if (props.spin && player) player.rotation.y += 0.006
    animate((now - started) / 1000)
    applyPunch()
    controls?.update()
    if (renderer && scene && camera) renderer.render(scene, camera)
  }
  frame = requestAnimationFrame(loop)

  const canvas = renderer.domElement

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) downOn = { x: event.clientX, y: event.clientY }
  })

  canvas.addEventListener('pointerup', (event) => {
    const start = downOn
    downOn = null

    if (event.button !== 0 || !start || !camera || !player) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return

    const box = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - box.left) / box.width) * 2 - 1
    pointer.y = -((event.clientY - box.top) / box.height) * 2 + 1

    raycaster.setFromCamera(pointer, camera)
    if (raycaster.intersectObject(player, true).length) punchUntil = performance.now() + PUNCH_MS
  })

  observer = new ResizeObserver(() => {
    if (!renderer || !camera || !scene || !el.clientWidth) return

    camera.aspect = el.clientWidth / Math.max(1, el.clientHeight)
    camera.updateProjectionMatrix()
    renderer.setSize(el.clientWidth, el.clientHeight)

    renderer.render(scene, camera)
  })
  observer.observe(el)
}

watch(host, (el) => {
  if (!el || renderer) return
  init(el)
}, { immediate: true, flush: 'post' })

watch(() => [props.skin, props.model, props.parts, props.yaw], buildPlayer)
watch(() => props.cape, buildCape)

onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
  controls?.dispose()
  disposeGroup(player)
  skinTexture?.dispose()
  capeTexture?.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
  renderer = undefined
})

defineExpose({ frameCamera })
</script>

<template>
  <div ref="host" class="h-[420px] w-full cursor-pointer rounded-2xl bg-[#0b0f16]" />
</template>
