<script setup lang="ts">
const props = withDefaults(defineProps<{
  piece: string
  color: number
  scale?: number
}>(), { scale: 8 })

const shade = (color: number, amount: number) => {
  const { r, g, b } = toRgb(color)
  const to = amount > 0 ? 255 : 0
  const t = Math.abs(amount)
  return toInt({
    r: Math.round(r + (to - r) * t),
    g: Math.round(g + (to - g) * t),
    b: Math.round(b + (to - b) * t)
  })
}

const cells = computed(() => {
  const rows = ARMOR_MASKS[props.piece] ?? []
  const palette: Record<string, string> = {
    d: '#1C1A1C',
    l: toHex(shade(props.color, 0.22)),
    b: toHex(props.color),
    s: toHex(shade(props.color, -0.28))
  }

  return rows.flatMap((row, y) =>
    Array.from(row).map((ch, x) => ({ x, y, fill: palette[ch] }))
      .filter(c => c.fill)
  )
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${ARMOR_SIZE} ${ARMOR_SIZE}`"
    :width="ARMOR_SIZE * scale"
    :height="ARMOR_SIZE * scale"
    shape-rendering="crispEdges"
    class="block"
    aria-hidden="true"
  >
    <rect v-for="c in cells" :key="`${c.x}-${c.y}`" :x="c.x" :y="c.y" width="1" height="1" :fill="c.fill" />
  </svg>
</template>
