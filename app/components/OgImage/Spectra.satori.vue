<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  label?: string
}>(), {
  title: 'Spectra',
  description: '',
  label: 'spectra.makoto.com.pl',
})
</script>

<template>
  <div
    class="flex h-full w-full flex-col justify-between bg-[#05080f] p-16 text-white"
    style="font-family: Inter, sans-serif"
  >
    <div class="flex w-full flex-col">
      <div class="flex h-2 w-40 rounded-full bg-[#7c5cff]" />
      <div class="mt-10 flex text-7xl font-bold leading-tight tracking-tight">
        {{ title }}
      </div>
      <div v-if="description" class="mt-6 flex text-3xl leading-snug text-[#9aa3b2]">
        {{ description.length > 130 ? `${description.slice(0, 130)}…` : description }}
      </div>
    </div>

    <div class="flex w-full items-center justify-between text-2xl text-[#6b7280]">
      <div class="flex font-semibold text-white">Spectra</div>
      <div class="flex">{{ label }}</div>
    </div>
  </div>
</template>
