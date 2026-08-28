<script setup lang="ts">
import { SKIN_SIZE, type SkinModel } from '~/utils/skin'
import { brushCells, line, skinRegions } from '~/utils/skinEdit'

const props = defineProps<{
  source: HTMLCanvasElement | null
  version: number
  model: SkinModel
  grid: boolean
  size: number
}>()

const emit = defineEmits<{
  begin: []
  paint: [x: number, y: number]
  end: []
}>()

const host = ref<HTMLElement>()
const view = ref<HTMLCanvasElement>()

let scale = 6
let originX = 0
let originY = 0
let painting = false
let last: [number, number] | null = null

const hover = ref<[number, number] | null>(null)

const regions = computed(() => skinRegions(props.model))

function draw() {
  const canvas = view.value
  const box = host.value
  if (!canvas || !box || !props.source) return

  const w = box.clientWidth
  const h = box.clientHeight
  const dpr = Math.min(window.devicePixelRatio, 2)

  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  scale = Math.max(1, Math.floor(Math.min(w, h) / SKIN_SIZE))
  const span = scale * SKIN_SIZE
  originX = Math.round((w - span) / 2)
  originY = Math.round((h - span) / 2)

  ctx.imageSmoothingEnabled = false

  for (let y = 0; y < SKIN_SIZE; y += 2) {
    for (let x = 0; x < SKIN_SIZE; x += 2) {
      ctx.fillStyle = '#1b1b1b'
      ctx.fillRect(originX + x * scale, originY + y * scale, scale, scale)
      ctx.fillRect(originX + (x + 1) * scale, originY + (y + 1) * scale, scale, scale)
    }
  }

  ctx.drawImage(props.source, originX, originY, span, span)

  if (props.grid && scale >= 4) {
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i <= SKIN_SIZE; i++) {
      ctx.moveTo(originX + i * scale + 0.5, originY)
      ctx.lineTo(originX + i * scale + 0.5, originY + span)
      ctx.moveTo(originX, originY + i * scale + 0.5)
      ctx.lineTo(originX + span, originY + i * scale + 0.5)
    }
    ctx.stroke()
  }

  if (hover.value) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    for (const [hx, hy] of brushCells(hover.value[0], hover.value[1], props.size)) {
      ctx.fillRect(originX + hx * scale, originY + hy * scale, scale, scale)
    }
  }

  ctx.lineWidth = 1
  for (const region of regions.value) {
    ctx.strokeStyle = region.overlay ? 'rgba(120,190,255,0.55)' : 'rgba(255,255,255,0.35)'
    for (const rect of region.rects) {
      ctx.strokeRect(
        originX + rect.x * scale + 0.5,
        originY + rect.y * scale + 0.5,
        rect.w * scale - 1,
        rect.h * scale - 1
      )
    }
  }
}

const texelAt = (event: PointerEvent): [number, number] | null => {
  const canvas = view.value
  if (!canvas) return null

  const box = canvas.getBoundingClientRect()
  const x = Math.floor((event.clientX - box.left - originX) / scale)
  const y = Math.floor((event.clientY - box.top - originY) / scale)

  if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE) return null
  return [x, y]
}

function down(event: PointerEvent) {
  const texel = texelAt(event)
  if (!texel) return

  painting = true
  last = texel
  view.value?.setPointerCapture(event.pointerId)
  emit('begin')
  emit('paint', texel[0], texel[1])
}

function move(event: PointerEvent) {
  const texel = texelAt(event)

  const previous = hover.value
  if (texel?.[0] !== previous?.[0] || texel?.[1] !== previous?.[1]) {
    hover.value = texel
    if (!painting) draw()
  }

  if (!painting || !texel) return

  const from = last ?? texel
  for (const [x, y] of line(from[0], from[1], texel[0], texel[1])) emit('paint', x, y)
  last = texel
}

function leave() {
  hover.value = null
  draw()
}

function up(event: PointerEvent) {
  if (!painting) return
  painting = false
  last = null
  view.value?.releasePointerCapture(event.pointerId)
  emit('end')
}

let observer: ResizeObserver | undefined

onMounted(() => {
  observer = new ResizeObserver(draw)
  if (host.value) observer.observe(host.value)
  draw()
})

onBeforeUnmount(() => observer?.disconnect())

watch(() => [props.version, props.grid, props.model, props.source, props.size], draw)
</script>

<template>
  <div ref="host" class="relative size-full">
    <canvas
      ref="view"
      class="size-full cursor-crosshair touch-none select-none"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
      @pointerleave="leave"
    />
  </div>
</template>
