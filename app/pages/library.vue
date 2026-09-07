<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

interface Item {
  id: string
  amount: number
  currency: string
  completed: number | null
  project: {
    id: string
    path: string
    title: string
    summary: string
    icon: string | null
  } | null
}

const { data } = await useFetch<{ items: Item[] }>('/api/catalog/library')

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(locale.value, { style: 'currency', currency: currency.toUpperCase() })
    .format(amount / 100)

const when = (ms: number | null) =>
  ms ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms)) : ''

useSeoMeta({ title: () => t('library.title'), robots: 'noindex' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-4xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight">{{ t('library.title') }}</h1>
        <p class="mt-3 text-base/relaxed text-muted">{{ t('library.intro') }}</p>

        <ul v-if="data?.items.length" class="mt-8 space-y-3">
          <li
            v-for="item in data.items"
            :key="item.id"
            class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm"
          >
            <div class="flex flex-wrap items-center gap-4">
              <span class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <img v-if="item.project?.icon" :src="item.project.icon" alt="" class="size-full object-cover">
                <UIcon v-else name="i-pixelarticons-package" class="size-6 text-dimmed" />
              </span>

              <div class="min-w-0 flex-1">
                <NuxtLink
                  v-if="item.project"
                  :to="localePath(item.project.path)"
                  class="truncate font-semibold hover:underline"
                >{{ item.project.title }}</NuxtLink>
                <span v-else class="text-dimmed">{{ t('library.gone') }}</span>
                <p class="mt-0.5 line-clamp-1 text-sm text-muted">{{ item.project?.summary }}</p>
              </div>

              <div class="text-right text-sm">
                <p class="font-medium">{{ money(item.amount, item.currency) }}</p>
                <p class="text-xs text-dimmed">{{ when(item.completed) }}</p>
              </div>
            </div>
          </li>
        </ul>

        <div v-else class="mt-10 rounded-3xl border border-zinc-600/50 bg-black/30 p-12 text-center backdrop-blur-sm">
          <UIcon name="i-pixelarticons-library" class="mx-auto size-10 text-dimmed" />
          <p class="mt-3 text-sm text-muted">{{ t('library.empty') }}</p>
        </div>
      </section>
    </div>
  </div>
</template>
