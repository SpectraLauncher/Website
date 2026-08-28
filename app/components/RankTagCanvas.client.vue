<script setup lang="ts">
const props = defineProps<{ state: RankTagState }>()

const emit = defineEmits<{ rendered: [{ dataUrl: string, width: number, height: number }] }>()

const canvas = ref<HTMLCanvasElement>()
const ready = ref(false)
let custom: HTMLImageElement | null = null

const loadCustom = async (src: string) => {
  if (!src) {
    custom = null
    return
  }
  custom = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

const render = () => {
  const el = canvas.value
  if (!el || !ready.value) return
  const result = drawRankTag(el, props.state, custom)
  emit('rendered', {
    dataUrl: el.toDataURL('image/png'),
    width: result.width,
    height: result.height
  })
}

onMounted(async () => {
  await ensureFont()
  await loadCustom(props.state.customIcon)
  ready.value = true
  render()
})

watch(() => props.state.customIcon, async (src) => {
  await loadCustom(src)
  render()
})

watch(() => ({ ...props.state }), render, { deep: true })

defineExpose({
  dataUrl: (scale: number) => (canvas.value ? scaledDataUrl(canvas.value, scale) : '')
})
</script>

<template>
  <canvas ref="canvas" class="hidden" />
</template>
