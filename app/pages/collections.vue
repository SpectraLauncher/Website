<script setup lang="ts">
interface Collection {
  id: string
  kind: 'favourites' | 'custom'
  title: string
  summary: string
  icon: string | null
  visibility: 'private' | 'unlisted' | 'listed'
  projects: number
  updated: number
}

const { t } = useI18n()
const localePath = useLocalePath()
const session = useAuthSession()

definePageMeta({ middleware: 'catalog' })
useHead({ title: () => t('nav.account.collections') })

watchEffect(() => {
  if (import.meta.client && !session.value.isPending && !session.value.data) {
    navigateTo(localePath('/login'))
  }
})

const collections = ref<Collection[]>([])
const loaded = ref(false)
const busy = ref('')
const error = ref('')
const creating = ref(false)
const draft = reactive({ title: '', summary: '', visibility: 'private' as Collection['visibility'] })

async function load() {
  try {
    const res = await $fetch<{ collections: Collection[] }>('/api/catalog/collections')
    collections.value = res.collections
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    loaded.value = true
  }
}

onMounted(load)

async function create() {
  if (!draft.title.trim()) return
  busy.value = 'create'
  error.value = ''
  try {
    await $fetch('/api/catalog/collections', { method: 'POST', body: { ...draft } })
    draft.title = ''
    draft.summary = ''
    creating.value = false
    await load()
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = ''
  }
}

async function remove(collection: Collection) {
  if (!confirm(t('collections.confirmDelete', { title: collection.title }))) return
  busy.value = collection.id
  try {
    await $fetch(`/api/catalog/collections/${collection.id}`, { method: 'DELETE' })
    await load()
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = ''
  }
}

// The built-in shelf carries a stored English title it never shows; its label
// comes from the locale like every other piece of chrome.
const label = (collection: Collection) =>
  collection.kind === 'favourites' ? t('collections.favourites') : collection.title

// It is the shelf everything lands on, so it goes first regardless of when it
// was last touched.
const ordered = computed(() =>
  [...collections.value].sort((a, b) =>
    Number(b.kind === 'favourites') - Number(a.kind === 'favourites')))

const VISIBILITIES = computed(() =>
  (['private', 'unlisted', 'listed'] as const).map(id => ({
    value: id,
    label: t(`collections.visibility.${id}`),
  })))
</script>

<template>
  <section class="mx-auto max-w-4xl px-4 py-12">
    <div class="mb-8 flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('nav.account.collections') }}</h1>
      <span class="flex-1"></span>
      <UButton
        color="neutral"
        class="rounded-xl"
        icon="i-lucide-plus"
        :label="t('collections.create')"
        @click="creating = !creating"
      />
    </div>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4 rounded-2xl" :description="error" />

    <div v-if="creating" class="mb-6 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
      <div class="grid gap-3 sm:grid-cols-2">
        <UInput v-model="draft.title" :placeholder="t('collections.titlePlaceholder')" />
        <USelect v-model="draft.visibility" :items="VISIBILITIES" value-key="value" />
        <UTextarea
          v-model="draft.summary"
          :rows="2"
          :placeholder="t('collections.summaryPlaceholder')"
          class="sm:col-span-2"
        />
      </div>
      <div class="mt-3 flex justify-end">
        <UButton
          color="neutral"
          class="rounded-xl"
          :disabled="!draft.title.trim()"
          :loading="busy === 'create'"
          :label="t('collections.create')"
          @click="create"
        />
      </div>
    </div>

    <ul v-if="collections.length" class="space-y-3">
      <li
        v-for="collection in ordered"
        :key="collection.id"
        class="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
      >
        <UIcon
          :name="collection.kind === 'favourites' ? 'i-lucide-star' : 'i-lucide-bookmark'"
          class="size-5 shrink-0"
          :class="collection.kind === 'favourites' ? 'text-primary' : 'text-muted'"
        />
        <NuxtLink :to="localePath(`/collection/${collection.id}`)" class="min-w-0 flex-1">
          <p class="truncate font-medium hover:underline">{{ label(collection) }}</p>
          <p class="truncate text-xs text-dimmed">
            {{ t('collections.count', { n: collection.projects }) }}
            · {{ t(`collections.visibility.${collection.visibility}`) }}
          </p>
        </NuxtLink>
        <UButton
          v-if="collection.kind !== 'favourites'"
          size="xs"
          variant="ghost"
          color="error"
          icon="i-lucide-trash-2"
          :loading="busy === collection.id"
          :aria-label="t('collections.delete')"
          @click="remove(collection)"
        />
      </li>
    </ul>

    <p v-else-if="loaded" class="rounded-2xl border border-white/10 p-10 text-center text-sm text-dimmed">
      {{ t('collections.empty') }}
    </p>
  </section>
</template>
