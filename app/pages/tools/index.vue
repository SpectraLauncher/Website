<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
const listUrl = computed(() => `${siteUrl}${localePath('/tools')}`)

const seoTitle = computed(() => `${t('toolsPage.title')}`)

defineOgImage('Spectra', {
  title: () => t('toolsPage.title'),
  description: () => t('toolsPage.sub')
})

useSeoMeta({
  title: () => seoTitle.value,
  description: () => t('toolsPage.sub'),
  ogTitle: () => seoTitle.value,
  ogDescription: () => t('toolsPage.sub'),
  ogUrl: () => listUrl.value,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => t('toolsPage.sub')
})

useSchemaOrg(computed(() => [
  defineWebPage({ '@type': 'CollectionPage' }),
  defineItemList({
    name: t('toolsPage.title'),
    itemListElement: TOOLS.map(tool => ({
      name: tool.name,
      description: t(`tools.${tool.id}`),
      url: localePath(`/tools/${tool.id}`)
    }))
  }),
  defineBreadcrumb({
    itemListElement: [
      { name: 'Spectra', item: localePath('/') },
      { name: t('nav.tools') }
    ]
  })
]))

const query = ref('')
const cat = ref<ToolCat | 'all'>('all')

const cats = ['all', 'fmt', 'design', 'cmd', 'calc', 'srv', 'skin'] as const

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return TOOLS.filter((tool) => {
    if (cat.value !== 'all' && tool.cat !== cat.value) return false
    if (!q) return true
    return tool.name.toLowerCase().includes(q) || t(`tools.${tool.id}`).toLowerCase().includes(q)
  })
})

const groups = computed(() =>
  cats
    .filter((c): c is ToolCat => c !== 'all')
    .map(c => ({ cat: c, tools: filtered.value.filter(tool => tool.cat === c) }))
    .filter(g => g.tools.length)
)
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto px-4 pb-14 pt-48">
        <div class="mb-3 flex items-center gap-3">
          <h1 class="text-5xl font-semibold tracking-tight">{{ t('toolsPage.title') }}</h1>
        </div>
        <p class="max-w-[62ch] text-lg text-muted">{{ t('toolsPage.sub') }}</p>

        <div class="mt-9 flex flex-wrap items-center gap-3">
          <UInput
            v-model="query"
            icon="i-lucide-search"
            size="lg"
            :placeholder="t('toolsPage.searchPh')"
            class="w-full sm:w-80"
          />

          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="c in cats"
              :key="c"
              :variant="cat === c ? 'subtle' : 'ghost'"
              size="sm"
              :label="t(`cats.${c}`)"
              @click="cat = c"
            />
          </div>
        </div>
      </section>

      <section class="container mx-auto px-4 pb-24">
        <div v-if="groups.length" class="flex flex-col gap-14">
          <div v-for="g in groups" :key="g.cat">
            <div class="mb-5 flex items-center gap-4">
              <h2 class="text-2xl font-semibold tracking-tight">{{ t(`cats.${g.cat}`) }}</h2>
              <div class="h-px flex-1 bg-zinc-600/50"></div>
              <span class="text-sm text-dimmed">{{ g.tools.length }}</span>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ToolCard v-for="tool in g.tools" :key="tool.id" :tool="tool" />
            </div>
          </div>
        </div>

        <div v-else class="rounded-3xl border border-zinc-600/50 bg-black/30 py-20 text-center backdrop-blur-sm">
          <UIcon name="i-lucide-search-x" class="mx-auto mb-3 size-8 text-dimmed" />
          <p class="text-muted">{{ t('toolsPage.empty') }}</p>
        </div>
      </section>
    </div>

    <DiscordCta />
  </div>
</template>
