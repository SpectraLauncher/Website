<script setup lang="ts">
// A viewer rather than a modal with a picture in it. A modal sizes itself to a
// dialog and leaves a screenshot in a box in the middle of the screen; this
// takes the whole viewport, keeps the arrow keys, and scales a small image up
// to fill the space instead of leaving it stranded at 400 pixels.
const props = defineProps<{
  images: Array<{ id: string, url: string, title: string }>
}>()

const index = defineModel<number | null>({ required: true })

const { t } = useI18n()

const shown = computed(() => (index.value === null ? null : props.images[index.value] ?? null))

function step(by: number) {
  if (index.value === null || !props.images.length) return
  index.value = (index.value + by + props.images.length) % props.images.length
}

function onKey(event: KeyboardEvent) {
  if (index.value === null) return

  if (event.key === 'Escape') index.value = null
  if (event.key === 'ArrowRight') step(1)
  if (event.key === 'ArrowLeft') step(-1)
}

// The page behind must not scroll while this is open, and the listener must go
// with the viewer rather than living for the life of the page.
watch(index, (open) => {
  if (!import.meta.client) return

  if (open !== null) {
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
  }
  else {
    window.removeEventListener('keydown', onKey)
    document.body.style.overflow = ''
  }
})

onUnmounted(() => {
  if (!import.meta.client) return
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="shown"
        class="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="index = null"
      >
        <header class="flex items-start gap-3 p-4">
          <p class="min-w-0 flex-1 text-sm text-muted">
            <span v-if="shown.title">{{ shown.title }}</span>
            <span v-if="images.length > 1" class="ml-2 text-dimmed">
              {{ (index ?? 0) + 1 }} / {{ images.length }}
            </span>
          </p>
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-pixelarticons-close"
            :aria-label="t('catalog.close')"
            @click="index = null"
          />
        </header>

        <div class="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
          <UButton
            v-if="images.length > 1"
            class="absolute left-2 z-10 rounded-xl"
            variant="subtle"
            color="neutral"
            icon="i-pixelarticons-chevron-left"
            :aria-label="t('catalog.previous')"
            @click="step(-1)"
          />

          <!-- A screenshot narrower than the viewport is scaled up to fill it,
               which is the whole reason for opening it. object-contain keeps
               the aspect ratio while it does. -->
          <img
            :src="shown.url"
            :alt="shown.title"
            class="max-h-full min-h-0 w-full rounded-xl object-contain"
            @click.stop
          >

          <UButton
            v-if="images.length > 1"
            class="absolute right-2 z-10 rounded-xl"
            variant="subtle"
            color="neutral"
            icon="i-pixelarticons-chevron-right"
            :aria-label="t('catalog.next')"
            @click="step(1)"
          />
        </div>

        <nav v-if="images.length > 1" class="flex gap-2 overflow-x-auto p-4 pt-0">
          <button
            v-for="(image, i) in images"
            :key="image.id"
            class="shrink-0 overflow-hidden rounded-lg border-2 transition-colors"
            :class="i === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'"
            @click="index = i"
          >
            <img :src="image.url" :alt="image.title" class="h-14 w-24 object-cover">
          </button>
        </nav>
      </div>
    </Transition>
  </Teleport>
</template>
