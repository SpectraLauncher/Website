<script setup lang="ts">
// One line under a file input saying what the picture will become, built from
// the same registry the endpoints are checked against — so it cannot promise a
// size the server does not keep.
const props = defineProps<{ id: ImageSpecId }>()

const { t } = useI18n()

const spec = computed(() => IMAGE_SPECS[props.id])

const line = computed(() => {
  const value = spec.value

  const shape = value.height ? 'images.banner' : value.fit === 'cover' ? 'images.square' : 'images.longest'

  return t(shape, {
    size: specDimensions(value),
    mb: specWeight(value),
    types: acceptedLabel(value.types),
  })
})
</script>

<template>
  <p class="text-xs text-dimmed">
    {{ line }}<template v-if="spec.animated"> {{ t('images.animated') }}</template>
  </p>
</template>
