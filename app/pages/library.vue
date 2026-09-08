<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

interface Item {
  projectId: string
  title: string
  icon: string | null
  path: string | null
  priceMinor: number
  granted: number
}

const { data } = await useFetch<{ items: Item[] }>('/api/catalog/library')

const money = (minor: number) => new Intl.NumberFormat(locale.value, {
  style: 'currency',
  currency: 'EUR',
}).format(minor / 100)

const when = (ms: number) => new Date(ms).toLocaleDateString(locale.value)

useSeoMeta({ title: () => t('library.title'), robots: 'noindex' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-3xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight">{{ t('library.title') }}</h1>
        <p class="mt-3 text-base/relaxed text-muted">{{ t('library.intro') }}</p>

        <p v-if="!data?.items.length" class="mt-8 text-muted">{{ t('library.empty') }}</p>

        <ul v-else class="mt-8 divide-y divide-default rounded-2xl border border-default">
          <li v-for="item in data.items" :key="item.projectId" class="flex items-center gap-3 p-4">
            <img v-if="item.icon" :src="item.icon" alt="" class="size-10 rounded-lg" />

            <div class="flex-1">
              <NuxtLink v-if="item.path" :to="localePath(item.path)" class="font-medium hover:underline">
                {{ item.title }}
              </NuxtLink>
              <!-- The project was removed; the purchase still happened. -->
              <span v-else class="font-medium text-muted">{{ item.title }}</span>

              <p class="text-sm text-muted">{{ when(item.granted) }}</p>
            </div>

            <span class="text-sm text-muted">{{ money(item.priceMinor) }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
