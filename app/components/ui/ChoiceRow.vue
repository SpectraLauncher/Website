<script setup lang="ts">
// Three or four choices, all of them worth reading at once. A select hides the
// options behind a click and hides the one thing that matters here — that
// private is not a milder version of unlisted.
const props = defineProps<{
  options: Array<{ value: string, label: string }>
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UButton
      v-for="option in props.options"
      :key="option.value"
      :color="model === option.value ? 'primary' : 'neutral'"
      :variant="model === option.value ? 'subtle' : 'ghost'"
      class="rounded-xl"
      :icon="model === option.value ? 'i-pixelarticons-check' : undefined"
      :label="option.label"
      :aria-pressed="model === option.value"
      @click="model = option.value"
    />
  </div>
</template>
