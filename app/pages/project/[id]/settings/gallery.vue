<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { ask } = useConfirm()

const id = computed(() => String(route.params.id ?? ''))
const { data, project, refresh } = useProjectEditor(id)

const busy = ref('')
const problem = ref('')
const shown = ref<number | null>(null)

const path = computed(() => `/api/catalog/project/${encodeURIComponent(project.value?.slug ?? '')}`)

// The working copy, so dragging reorders instantly and the request follows.
const images = ref<Array<{ id: string, url: string, title: string, featured: boolean }>>([])

watchEffect(() => {
  images.value = [...(data.value?.gallery ?? [])]
})

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

async function send(files: File[]) {
  const accepted = files.filter(file => ACCEPTED.includes(file.type))
  if (!accepted.length) {
    if (files.length) problem.value = t('catalog.notAnImage')
    return
  }

  busy.value = 'upload'
  problem.value = ''
  try {
    for (const file of accepted) {
      await $fetch(`${path.value}/gallery`, {
        method: 'POST',
        body: await file.arrayBuffer(),
        headers: { 'content-type': file.type },
      })
    }
    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = '' }
}

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  await send([...(input.files ?? [])])
  input.value = ''
}

// Dropping a file on the page is what a browser treats as "open this file",
// which would navigate away from the form. The counter is because dragover
// fires for every child element the pointer crosses.
const over = ref(0)

function enter(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  over.value++
}

function leave() {
  over.value = Math.max(0, over.value - 1)
}

async function dropFiles(event: DragEvent) {
  over.value = 0
  await send([...(event.dataTransfer?.files ?? [])])
}

async function patch(imageId: string, body: Record<string, unknown>) {
  busy.value = imageId
  problem.value = ''
  try {
    await $fetch(`${path.value}/gallery/${imageId}`, { method: 'PATCH', body })

    // Without this the star does nothing until the page is loaded again: the
    // request lands, the list on screen still holds the old value.
    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = '' }
}

async function remove(image: { id: string }) {
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

// Native drag events rather than a library: the whole behaviour is which index
// was picked up and which one it was let go over.
const dragging = ref<number | null>(null)

// A file dropped on a tile bubbles up to the root handler, which is where an
// upload belongs. Nothing was picked up here, so there is nothing to move.
function drop(target: number) {
  const from = dragging.value
  dragging.value = null
  if (from === null || from === target) return

  const next = [...images.value]
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved!)
  images.value = next

  // Ordering is stored per image, so the new positions all have to be sent.
  saveOrder()
}

async function saveOrder() {
  busy.value = 'order'
  problem.value = ''
  try {
    await Promise.all(images.value.map((image, index) =>
      $fetch(`${path.value}/gallery/${image.id}`, {
        method: 'PATCH',
        body: { ordering: index },
      })))
    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = '' }
}
</script>

<template>
  <div
    class="rounded-3xl border p-6 backdrop-blur-sm transition-colors"
    :class="over ? 'border-primary bg-primary/5' : 'border-zinc-600/50 bg-black/30'"
    @dragenter.prevent="enter"
    @dragover.prevent
    @dragleave.prevent="leave"
    @drop.prevent="dropFiles"
  >
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
      <input
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        class="hidden"
        @change="upload"
      >
    </label>

    <p class="mt-3 text-xs text-dimmed">
      {{ over ? t('catalog.dropHere') : t('catalog.dropHint') }}
      <template v-if="images.length > 1"> · {{ t('catalog.dragToOrder') }}</template>
    </p>

    <ul v-if="images.length" class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <li
        v-for="(image, index) in images"
        :key="image.id"
        class="rounded-2xl border bg-white/5 p-3 transition-colors"
        :class="dragging === index ? 'border-primary/60 opacity-60' : 'border-white/10'"
        draggable="true"
        @dragstart="dragging = index"
        @dragend="dragging = null"
        @dragover.prevent
        @drop.prevent="drop(index)"
      >
        <div class="mb-2 flex items-center gap-2">
          <UIcon name="i-pixelarticons-drag-and-drop" class="size-4 shrink-0 cursor-grab text-dimmed" />
          <span class="flex-1 text-xs text-dimmed">{{ index + 1 }}</span>
          <UButton
            size="xs"
            :variant="image.featured ? 'subtle' : 'ghost'"
            :color="image.featured ? 'primary' : 'neutral'"
            class="rounded-lg"
            icon="i-pixelarticons-star"
            :loading="busy === image.id"
            :aria-label="t('catalog.featured')"
            :title="t('catalog.featured')"
            @click="patch(image.id, { featured: !image.featured })"
          />
          <UButton
            size="xs"
            variant="ghost"
            color="error"
            class="rounded-lg"
            icon="i-pixelarticons-trash"
            :loading="busy === image.id"
            :aria-label="t('catalog.admin.delete')"
            @click="remove(image)"
          />
        </div>

        <button class="block w-full" @click="shown = index">
          <img
            :src="image.url"
            :alt="image.title"
            class="aspect-video w-full rounded-xl border border-white/10 object-cover"
          >
        </button>

        <UInput
          :model-value="image.title"
          :placeholder="t('catalog.imageTitle')"
          size="sm"
          class="mt-2 w-full"
          @blur="(e: FocusEvent) => patch(image.id, { title: (e.target as HTMLInputElement).value })"
        />
      </li>
    </ul>

    <p v-else class="mt-5 text-sm text-dimmed">{{ t('catalog.noGallery') }}</p>

    <ImageLightbox v-model="shown" :images="images" />
  </div>
</template>
