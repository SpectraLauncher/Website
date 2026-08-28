<script setup lang="ts">
const props = withDefaults(defineProps<{
  potionKey: string
  color: string
  size?: number
}>(), { size: 40 })

const failed = ref(false)
const src = computed(() => potionTexture(props.potionKey))
const id = useId()

watch(src, () => { failed.value = false })
</script>

<template>
  <img
    v-if="!failed"
    :src="src"
    :width="props.size"
    :height="props.size"
    alt=""
    aria-hidden="true"
    class="shrink-0 [image-rendering:pixelated]"
    loading="lazy"
    @error="failed = true"
  >

  <svg
    v-else
    :width="props.size"
    :height="props.size"
    viewBox="0 0 40 44"
    fill="none"
    aria-hidden="true"
    class="shrink-0"
  >
    <defs>
      <clipPath :id="id">
        <circle cx="20" cy="29" r="11" />
        <rect x="16" y="9" width="8" height="16" rx="1" />
      </clipPath>
    </defs>

    <rect x="15" y="3" width="10" height="7" rx="1.5" fill="#C99B66" />
    <rect x="16" y="9" width="8" height="16" rx="1" fill="#D8D8D8" fill-opacity="0.28" />
    <circle cx="20" cy="29" r="11" fill="#D8D8D8" fill-opacity="0.28" />

    <g :clip-path="`url(#${id})`">
      <rect x="6" y="20" width="28" height="24" :fill="color" />
      <rect x="6" y="20" width="28" height="2" fill="#FFFFFF" fill-opacity="0.35" />
    </g>

    <circle cx="20" cy="29" r="11" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="1.5" />
    <rect x="16" y="9" width="8" height="16" rx="1" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="1.5" />
    <rect x="15" y="3" width="10" height="7" rx="1.5" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="1.5" />
  </svg>
</template>
