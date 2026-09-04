<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

interface Preview {
  size: [number, number, number]
  palette: string[]
  colors: number[]
  voxels: string
  total: number
  shown: number
  truncated: boolean
}

const props = defineProps<{ src: string }>()

const host = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const failed = ref(false)
const preview = ref<Preview | null>(null)

const layer = ref(0)
const maxLayer = ref(0)

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let mesh: THREE.InstancedMesh | undefined
let observer: ResizeObserver | undefined
let frame = 0
let dirty = true

// Voxels arrive sorted by height, so showing the build up to a given layer is a
// change to instanceCount and nothing else — no buffer is rebuilt when the
// slider moves.
let layerOffsets: number[] = []

function decode(base64: string): Uint16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Uint16Array(bytes.buffer)
}

function build(data: Preview) {
  const packed = decode(data.voxels)
  const count = packed.length / 4
  const [sx, sy, sz] = data.size

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshLambertMaterial({ vertexColors: true })

  mesh = new THREE.InstancedMesh(geometry, material, count)
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()

  layerOffsets = Array.from({ length: sy + 1 }, () => count)
  let seen = -1

  for (let i = 0; i < count; i++) {
    const x = packed[i * 4]!
    const y = packed[i * 4 + 1]!
    const z = packed[i * 4 + 2]!
    const index = packed[i * 4 + 3]!

    while (seen < y) layerOffsets[++seen] = i

    matrix.setPosition(x - sx / 2 + 0.5, y - sy / 2 + 0.5, z - sz / 2 + 0.5)
    mesh.setMatrixAt(i, matrix)

    color.setHex(data.colors[index] ?? 0x808080)
    mesh.setColorAt(i, color)
  }
  while (seen < sy) layerOffsets[++seen] = count

  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

  maxLayer.value = sy
  layer.value = sy
  scene!.add(mesh)
}

function applyLayer() {
  if (!mesh) return
  mesh.count = layerOffsets[Math.min(layer.value, layerOffsets.length - 1)] ?? mesh.count
  dirty = true
}

function resize() {
  if (!renderer || !camera || !host.value) return
  const { clientWidth, clientHeight } = host.value
  if (!clientWidth || !clientHeight) return

  renderer.setSize(clientWidth, clientHeight, false)
  camera.aspect = clientWidth / clientHeight
  camera.updateProjectionMatrix()
  dirty = true
}

async function start() {
  let data: Preview
  try {
    data = await $fetch<Preview>(props.src)
  } catch {
    failed.value = true
    loading.value = false
    return
  }

  preview.value = data
  loading.value = false
  await nextTick()
  if (!host.value) return

  scene = new THREE.Scene()

  const [sx, sy, sz] = data.size
  const span = Math.max(sx, sy, sz)

  camera = new THREE.PerspectiveCamera(50, 1, 0.1, span * 12 + 100)
  camera.position.set(span * 1.1, span * 0.9, span * 1.1)

  scene.add(new THREE.AmbientLight(0xFFFFFF, 1.4))
  const key = new THREE.DirectionalLight(0xFFFFFF, 1.5)
  key.position.set(1, 2, 1.5)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xFFFFFF, 0.6)
  fill.position.set(-1.5, 0.5, -1)
  scene.add(fill)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  host.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.addEventListener('change', () => (dirty = true))

  build(data)
  resize()

  observer = new ResizeObserver(resize)
  observer.observe(host.value)

  // Only draws when something moved. A static build with the camera at rest
  // costs nothing, which matters on a laptop with integrated graphics.
  const loop = () => {
    frame = requestAnimationFrame(loop)
    if (controls?.update()) dirty = true
    if (!dirty) return
    dirty = false
    renderer!.render(scene!, camera!)
  }
  loop()
}

watch(layer, applyLayer)

onMounted(start)

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  controls?.dispose()
  mesh?.geometry.dispose()
  ;(mesh?.material as THREE.Material | undefined)?.dispose()
  mesh?.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div class="overflow-hidden rounded-3xl border border-zinc-600/50 bg-black/30 backdrop-blur-sm">
    <div ref="host" class="relative h-[420px] w-full">
      <div v-if="loading" class="absolute inset-0 grid place-items-center text-sm text-dimmed">
        <span class="inline-flex items-center gap-2">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
          {{ $t('catalog.schematic.loadingPreview') }}
        </span>
      </div>
      <div v-else-if="failed" class="absolute inset-0 grid place-items-center px-6 text-center text-sm text-dimmed">
        {{ $t('catalog.schematic.noPreview') }}
      </div>
    </div>

    <div v-if="preview && !failed" class="flex flex-wrap items-center gap-4 border-t border-white/10 px-5 py-3">
      <label class="flex flex-1 items-center gap-3 text-xs text-dimmed">
        <UIcon name="i-lucide-layers" class="size-4 shrink-0" />
        <input
          v-model.number="layer"
          type="range"
          min="0"
          :max="maxLayer"
          class="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-primary"
        >
        <span class="w-16 shrink-0 text-right font-mono">{{ layer }} / {{ maxLayer }}</span>
      </label>

      <span class="text-xs text-dimmed">
        {{ $t('catalog.schematic.blocks') }}: {{ preview.total.toLocaleString() }}
        <template v-if="preview.truncated"> · {{ $t('catalog.schematic.partial') }}</template>
      </span>
    </div>
  </div>
</template>
