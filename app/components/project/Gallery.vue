<script setup lang="ts">
const props = defineProps<{
  gallery: Array<{ id: string, url: string, title: string, featured: boolean }>
}>()

const { t } = useI18n()

const shown = ref<number | null>(null)

// Featured first, because that is the one the author chose to represent it.
const images = computed(() =>
  [...props.gallery].sort((a, b) => Number(b.featured) - Number(a.featured)))
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-4 text-lg font-semibold">{{ t('catalog.gallery') }}</h2>

    <ul v-if="images.length" class="grid gap-3 sm:grid-cols-2">
      <li v-for="(image, index) in images" :key="image.id">
        <button class="group block w-full text-left" @click="shown = index">
          <span class="block overflow-hidden rounded-2xl border border-white/10 transition-colors group-hover:border-zinc-500">
            <img
              :src="image.url"
              :alt="image.title"
              loading="lazy"
              class="aspect-video w-full object-cover"
            >
          </span>
          <span v-if="image.title" class="mt-2 block text-sm text-muted">{{ image.title }}</span>
        </button>
      </li>
    </ul>

    <p v-else class="text-sm text-dimmed">{{ t('catalog.noGallery') }}</p>

    <UiImageLightbox v-model="shown" :images="images" />
  </div>
</template>
