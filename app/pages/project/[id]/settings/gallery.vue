<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { ask } = useConfirm()

const id = computed(() => String(route.params.id ?? ''))
const { data, project, refresh } = useProjectEditor(id)

const busy = ref('')
const problem = ref('')

const path = computed(() => `/api/catalog/project/${encodeURIComponent(project.value?.slug ?? '')}`)

async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  busy.value = 'upload'
  problem.value = ''
  try {
    await $fetch(`${path.value}/gallery`, {
      method: 'POST',
      body: await file.arrayBuffer(),
      headers: { 'content-type': file.type },
    })
    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = '' }
}

async function rename(image: { id: string, title: string }, title: string) {
  busy.value = image.id
  try {
    await $fetch(`${path.value}/gallery/${image.id}`, { method: 'PATCH', body: { title } })
    await refresh()
  }
  catch (e: any) { problem.value = e?.data?.statusMessage || t('auth.genericError') }
  finally { busy.value = '' }
}

async function feature(image: { id: string, featured: boolean }) {
  busy.value = image.id
  try {
    await $fetch(`${path.value}/gallery/${image.id}`, {
      method: 'PATCH',
      body: { featured: !image.featured },
    })
    await refresh()
  }
  catch (e: any) { problem.value = e?.data?.statusMessage || t('auth.genericError') }
  finally { busy.value = '' }
}

async function remove(image: { id: string, title: string }) {
  const ok = await ask({
    title: t('catalog.confirmRemoveImage'),
    confirmLabel: t('catalog.admin.delete'),
    danger: true,
  })
  if (!ok) return

  busy.value = image.id
  try {
    await $fetch(`${path.value}/gallery/${image.id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (e: any) { problem.value = e?.data?.statusMessage || t('auth.genericError') }
  finally { busy.value = '' }
}
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.projectTabs.gallery') }}</h2>
    <p class="mb-5 text-sm text-muted">{{ t('catalog.settingsHint.gallery') }}</p>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <label
      class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-600/50 bg-black/30 px-3 py-2 text-sm transition-colors hover:border-zinc-500"
    >
      <UIcon name="i-pixelarticons-image-plus" class="size-4" />
      {{ busy === 'upload' ? t('catalog.org.uploading') : t('catalog.addImage') }}
      <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="upload">
    </label>

    <ul v-if="data?.gallery.length" class="mt-5 space-y-3">
      <li
        v-for="image in data.gallery"
        :key="image.id"
        class="flex flex-wrap items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-3"
      >
        <img
          :src="image.url"
          :alt="image.title"
          class="h-20 w-32 shrink-0 rounded-xl border border-white/10 object-cover"
        >
        <div class="min-w-0 flex-1 space-y-2">
          <UInput
            :model-value="image.title"
            :placeholder="t('catalog.imageTitle')"
            class="w-full"
            size="sm"
            @blur="(e: FocusEvent) => rename(image, (e.target as HTMLInputElement).value)"
          />
          <div class="flex flex-wrap gap-2">
            <UButton
              size="xs"
              :variant="image.featured ? 'subtle' : 'ghost'"
              :color="image.featured ? 'primary' : 'neutral'"
              class="rounded-xl"
              icon="i-pixelarticons-star"
              :loading="busy === image.id"
              :label="t('catalog.featured')"
              @click="feature(image)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              class="rounded-xl"
              icon="i-pixelarticons-trash"
              :loading="busy === image.id"
              :label="t('catalog.admin.delete')"
              @click="remove(image)"
            />
          </div>
        </div>
      </li>
    </ul>

    <p v-else class="mt-5 text-sm text-dimmed">{{ t('catalog.noGallery') }}</p>
  </div>
</template>
