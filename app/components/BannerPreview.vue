<script setup lang="ts">
const props = withDefaults(defineProps<{
  base: string
  layers: BannerLayer[]
  scale?: number
  shield?: boolean
}>(), { scale: 6, shield: false })

const canvas = ref<HTMLCanvasElement>()

const paint = () => {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return

  const img = ctx.createImageData(BANNER_W, BANNER_H)
  const put = (x: number, y: number, hex: string, alpha = 1) => {
    const i = (y * BANNER_W + x) * 4
    const n = parseInt(hex.slice(1), 16)
    img.data[i] = (n >> 16) & 0xFF
    img.data[i + 1] = (n >> 8) & 0xFF
    img.data[i + 2] = n & 0xFF
    img.data[i + 3] = Math.round(alpha * 255)
  }

  const baseHex = bannerHex(props.base)
  for (let y = 0; y < BANNER_H; y++) {
    for (let x = 0; x < BANNER_W; x++) put(x, y, baseHex)
  }

  for (const layer of props.layers) {
    const pattern = patternById(layer.pattern)
    if (!pattern) continue
    const hex = bannerHex(layer.color)

    for (let y = 0; y < BANNER_H; y++) {
      const ramp = layer.pattern === 'gradient'
        ? 1 - y / (BANNER_H - 1)
        : layer.pattern === 'gradient_up'
          ? y / (BANNER_H - 1)
          : 1

      for (let x = 0; x < BANNER_W; x++) {
        if (!maskAt(pattern.mask, x, y)) continue
        if (ramp >= 1) { put(x, y, hex); continue }

        const i = (y * BANNER_W + x) * 4
        const n = parseInt(hex.slice(1), 16)
        img.data[i] = Math.round(img.data[i]! * (1 - ramp) + ((n >> 16) & 0xFF) * ramp)
        img.data[i + 1] = Math.round(img.data[i + 1]! * (1 - ramp) + ((n >> 8) & 0xFF) * ramp)
        img.data[i + 2] = Math.round(img.data[i + 2]! * (1 - ramp) + (n & 0xFF) * ramp)
      }
    }
  }

  ctx.putImageData(img, 0, 0)
}

onMounted(paint)
watch(() => [props.base, props.layers.map(l => l.pattern + l.color).join()], paint, { deep: true })
</script>

<template>
  <div class="relative inline-block">
    <canvas
      ref="canvas"
      :width="BANNER_W"
      :height="BANNER_H"
      class="block [image-rendering:pixelated]"
      :class="shield ? 'rounded-b-[45%] rounded-t-lg' : ''"
      :style="{ width: `${BANNER_W * scale}px`, height: `${BANNER_H * scale}px` }"
    />
    <div
      v-if="!shield"
      class="pointer-events-none absolute inset-x-0 top-0 bg-[#6b4a2f]"
      :style="{ height: `${scale}px`, marginTop: `${-scale * 1.5}px` }"
    />
  </div>
</template>
