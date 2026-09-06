<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

useSeoMeta({
  title: () => t('docs.api.title'),
  description: () => t('docs.api.intro'),
})

const search = ref('')

const shown = computed(() => {
  const needle = search.value.trim().toLowerCase()
  if (!needle) return API_ENDPOINTS

  return API_ENDPOINTS.filter(endpoint =>
    endpoint.route.toLowerCase().includes(needle)
    || endpoint.summary.toLowerCase().includes(needle))
})

const groups = computed(() =>
  API_GROUPS
    .map(group => ({ group, items: shown.value.filter(e => e.group === group) }))
    .filter(entry => entry.items.length))

const AUTH_COLOR: Record<string, 'neutral' | 'warning' | 'error'> = {
  none: 'neutral',
  session: 'warning',
  token: 'warning',
  admin: 'error',
}

const METHOD_COLOR: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  GET: 'success',
  POST: 'warning',
  PATCH: 'warning',
  PUT: 'warning',
  DELETE: 'error',
  OPTIONS: 'neutral',
}

const split = (route: string) => {
  const [method, ...rest] = route.split(' ')
  return { method: method ?? 'GET', path: rest.join(' ') }
}
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-12">
    <NuxtLink
      :to="localePath('/docs')"
      class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-default"
    >
      <UIcon name="i-lucide-arrow-left" class="size-4" />
      {{ t('docs.title') }}
    </NuxtLink>

    <h1 class="text-3xl font-semibold tracking-tight">{{ t('docs.api.title') }}</h1>
    <p class="mt-3 max-w-prose text-muted">{{ t('docs.api.intro') }}</p>

    <div class="mt-6 grid gap-3 sm:grid-cols-2">
      <div class="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h2 class="mb-1 text-sm font-semibold">{{ t('docs.api.authTitle') }}</h2>
        <p class="text-xs/relaxed text-muted">{{ t('docs.api.authBody') }}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h2 class="mb-1 text-sm font-semibold">{{ t('docs.api.limitsTitle') }}</h2>
        <p class="text-xs/relaxed text-muted">{{ t('docs.api.limitsBody') }}</p>
      </div>
    </div>

    <UInput
      v-model="search"
      class="mt-8 w-full"
      size="lg"
      icon="i-lucide-search"
      :placeholder="t('docs.api.search')"
    />

    <div v-for="entry in groups" :key="entry.group" class="mt-8">
      <h2 class="mb-3 text-lg font-semibold">{{ t(`docs.api.groups.${entry.group}`) }}</h2>

      <ul class="space-y-1.5">
        <li
          v-for="endpoint in entry.items"
          :key="endpoint.route"
          class="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
        >
          <UBadge
            size="sm"
            variant="subtle"
            class="font-mono"
            :color="METHOD_COLOR[split(endpoint.route).method] ?? 'neutral'"
            :label="split(endpoint.route).method"
          />
          <code class="min-w-0 flex-1 break-all font-mono text-xs">
            {{ split(endpoint.route).path }}
          </code>
          <span class="min-w-0 flex-1 text-xs text-muted">{{ endpoint.summary }}</span>
          <UBadge
            size="sm"
            variant="subtle"
            :color="AUTH_COLOR[endpoint.auth] ?? 'neutral'"
            :label="t(`docs.api.auth.${endpoint.auth}`)"
          />
        </li>
      </ul>
    </div>

    <p v-if="!groups.length" class="mt-8 text-sm text-dimmed">{{ t('docs.api.nothing') }}</p>
  </section>
</template>
