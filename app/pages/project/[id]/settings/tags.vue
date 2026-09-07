<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()

const id = computed(() => String(route.params.id ?? ''))
const { project, refresh } = useProjectEditor(id)

const busy = ref(false)
const saved = ref(false)
const problem = ref('')

const categories = ref<string[]>([])
const featured = ref<string[]>([])
const environment = ref<string[]>([])

watchEffect(() => {
  if (!project.value) return
  categories.value = [...project.value.categories]
  featured.value = [...((project.value as { featuredCategories?: string[] }).featuredCategories ?? [])]
  environment.value = [...(project.value.environment ?? [])]
})

const available = computed(() =>
  CATEGORIES[project.value?.type as keyof typeof CATEGORIES] ?? [])

const full = computed(() => featured.value.length >= MAX_FEATURED_CATEGORIES)

function toggle(category: string) {
  categories.value = categories.value.includes(category)
    ? categories.value.filter(c => c !== category)
    : [...categories.value, category]

  // Unpicking a category unpicks it from the front row too, so nothing is
  // featured that the project no longer claims.
  featured.value = featured.value.filter(c => categories.value.includes(c))
}

function feature(category: string) {
  if (featured.value.includes(category)) {
    featured.value = featured.value.filter(c => c !== category)
    return
  }
  if (full.value) return

  featured.value = [...featured.value, category]
}

async function save() {
  busy.value = true
  problem.value = ''
  try {
    await $fetch(`/api/catalog/project/${encodeURIComponent(project.value!.slug)}`, {
      method: 'PATCH',
      body: {
        categories: categories.value,
        featuredCategories: featured.value,
        environment: environment.value,
      },
    })
    await refresh()
    saved.value = true
    setTimeout(() => (saved.value = false), 4000)
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = false }
}
</script>

<template>
  <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
    <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.projectTabs.tags') }}</h2>
    <p class="mb-5 text-sm text-muted">{{ t('catalog.settingsHint.categories') }}</p>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <!-- A column of checkboxes makes eighteen categories a scroll. A grid makes
         them a glance, which is what picking from a fixed list should be. -->
    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <label
        v-for="category in available"
        :key="category"
        class="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors"
        :class="categories.includes(category)
          ? 'border-primary/50 bg-primary/10'
          : 'border-white/10 bg-white/5 hover:border-white/20'"
      >
        <input
          type="checkbox"
          class="size-5 shrink-0 accent-primary"
          :checked="categories.includes(category)"
          @change="toggle(category)"
        >
        <span class="min-w-0 flex-1 truncate text-sm">
          {{ t(`catalog.categoryNames.${category}`) }}
        </span>
      </label>
    </div>

    <div class="mt-8">
      <h3 class="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {{ t('catalog.featuredTags') }}
        <UBadge
          size="sm"
          variant="subtle"
          :color="featured.length ? 'primary' : 'neutral'"
          :label="`${featured.length}/${MAX_FEATURED_CATEGORIES}`"
        />
      </h3>
      <p class="mt-1 text-sm text-muted">{{ t('catalog.settingsHint.featuredTags') }}</p>

      <div v-if="categories.length" class="mt-3 flex flex-wrap gap-2">
        <UButton
          v-for="category in categories"
          :key="category"
          size="sm"
          class="rounded-xl"
          :color="featured.includes(category) ? 'primary' : 'neutral'"
          :variant="featured.includes(category) ? 'subtle' : 'ghost'"
          :icon="featured.includes(category) ? 'i-pixelarticons-star' : undefined"
          :disabled="!featured.includes(category) && full"
          :label="t(`catalog.categoryNames.${category}`)"
          @click="feature(category)"
        />
      </div>
      <p v-else class="mt-3 text-sm text-dimmed">{{ t('catalog.pickCategoryFirst') }}</p>
    </div>

    <div class="mt-8">
      <h3 class="text-sm font-semibold">{{ t('catalog.environment') }}</h3>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <label
          v-for="side in ENVIRONMENTS"
          :key="side"
          class="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors"
          :class="environment.includes(side)
            ? 'border-primary/50 bg-primary/10'
            : 'border-white/10 bg-white/5 hover:border-white/20'"
        >
          <input v-model="environment" type="checkbox" :value="side" class="size-5 shrink-0 accent-primary">
          <span class="text-sm">{{ t(`catalog.environments.${side}`) }}</span>
        </label>
      </div>
    </div>

    <div class="mt-6 flex items-center gap-3">
      <UButton class="rounded-xl" :label="t('account.save')" :loading="busy" @click="save" />
      <span v-if="saved" class="text-sm text-primary">{{ t('account.saved') }}</span>
    </div>
  </div>
</template>
