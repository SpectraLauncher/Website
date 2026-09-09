<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = withDefaults(defineProps<{
  opts: CircleOptions
  highlight?: number
  color?: string
  dimOpacity?: number
}>(), { color: '#A2CFFE', dimOpacity: 0.25 })

const MAX_INSTANCES = 200_000

const host = ref<HTMLElement>()
const tooBig = ref(false)

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let meshes: THREE.InstancedMesh[] = []
let frame = 0
let framed = false

const disposeMeshes = () => {
  for (const m of meshes) {
    scene?.remove(m)
    m.geometry.dispose()
    ;(m.material as THREE.Material).dispose()
  }
  meshes = []
}

const build = () => {
  if (!scene) return
  disposeMeshes()

  const layers = layerCount(props.opts)
  const normal: THREE.Vector3[] = []
  const highlighted: THREE.Vector3[] = []

  const dims = dimensions(props.opts)
  const cx = dims.width / 2
  const cy = layers / 2
  const cz = dims.depth / 2

  for (let y = 0; y < layers; y++) {
    const { cells } = buildLayer(props.opts, y)
    const bucket = props.highlight === y ? highlighted : normal

    for (let z = 0; z < cells.length; z++) {
      const row = cells[z]!
      for (let x = 0; x < row.length; x++) {
        if (row[x]) bucket.push(new THREE.Vector3(x - cx + 0.5, y - cy + 0.5, z - cz + 0.5))
      }
    }
  }

  tooBig.value = normal.length + highlighted.length > MAX_INSTANCES
  if (tooBig.value) return

  const make = (positions: THREE.Vector3[], material: THREE.Material, order: number) => {
    if (!positions.length) return
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, positions.length)
    mesh.renderOrder = order
    const m = new THREE.Matrix4()
    positions.forEach((p, i) => {
      m.setPosition(p)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    scene!.add(mesh)
    meshes.push(mesh)
  }

  const base = new THREE.Color(props.color)
  const bright = base.clone().lerp(new THREE.Color(0xffffff), 0.45)
  const glow = base.clone().multiplyScalar(0.35)
  const opaque = props.dimOpacity >= 1

  make(normal, new THREE.MeshLambertMaterial({
    color: base,
    transparent: !opaque,
    opacity: props.dimOpacity,
    depthWrite: opaque
  }), 0)

  make(highlighted, new THREE.MeshLambertMaterial({
    color: bright,
    emissive: glow,
    emissiveIntensity: 0.6
  }), 1)

  if (!framed && camera && controls) {
    const radius = Math.max(dims.width, layers, dims.depth)
    camera.position.set(radius * 1.3, radius * 1.0, radius * 1.3)
    controls.target.set(0, 0, 0)
    controls.update()
    framed = true
  }
}

onMounted(() => {
  const el = host.value
  if (!el) return

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 2000)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(1, 1.4, 0.8)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x88aaff, 0.5)
  fill.position.set(-1, -0.4, -0.8)
  scene.add(fill)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false

  build()

  const loop = () => {
    frame = requestAnimationFrame(loop)
    controls?.update()
    if (renderer && scene && camera) renderer.render(scene, camera)
  }
  loop()

  const observer = new ResizeObserver(() => {
    if (!renderer || !camera || !el.clientWidth) return
    camera.aspect = el.clientWidth / el.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(el.clientWidth, el.clientHeight)
  })
  observer.observe(el)

  onBeforeUnmount(() => {
    observer.disconnect()
    cancelAnimationFrame(frame)
    controls?.dispose()
    disposeMeshes()
    renderer?.dispose()
    renderer?.domElement.remove()
  })
})

watch(() => props, build, { deep: true })
</script>

<template>
  <div class="relative">
    <div ref="host" class="h-[420px] w-full rounded-2xl bg-[#101010]" />
    <p v-if="tooBig" class="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">
      {{ $t('circle.tooBig') }}
    </p>
  </div>
</template>
