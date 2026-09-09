<script setup lang="ts">
const route = useRoute()
const { t, locale } = useI18n()

const token = computed(() => String(route.params.token ?? ''))

interface Item {
  title: string
  priceMinor: number
  projectId: string | null
  file: { id: string, filename: string, size: number } | null
}

const { data, error } = await useFetch<{
  email: string | null
  totalMinor: number
  items: Item[]
}>(() => `/api/catalog/order/${encodeURIComponent(token.value)}`)

const money = (minor: number) => new Intl.NumberFormat(locale.value, {
  style: 'currency',
  currency: 'EUR',
}).format(minor / 100)

const size = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`

// The link carries the token, because that is the whole credential here - there
// is no session to fall back on.
const downloadUrl = (fileId: string) =>
  `/api/catalog/download/${fileId}?token=${encodeURIComponent(token.value)}`

// The address bar holds a working key to somebody's purchase, so it stays out
// of search engines and out of referrer headers.
useSeoMeta({ title: () => t('order.title'), robots: 'noindex, nofollow' })
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })
</script>

<template>
  <div>
    <SiteNavbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-2xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight">{{ t('order.title') }}</h1>

        <p v-if="error" class="mt-6 text-muted">{{ t('order.missing') }}</p>

        <template v-else-if="data">
          <p class="mt-3 text-base/relaxed text-muted">{{ t('order.intro') }}</p>

          <ul class="mt-8 divide-y divide-default rounded-2xl border border-default">
            <li v-for="(item, i) in data.items" :key="i" class="flex items-center gap-3 p-4">
              <div class="flex-1">
                <p class="font-medium">{{ item.title }}</p>
                <p v-if="item.file" class="text-sm text-muted">
                  {{ item.file.filename }} · {{ size(item.file.size) }}
                </p>
                <!-- Removed since the purchase. The row stays so the receipt
                     still says what was bought. -->
                <p v-else class="text-sm text-muted">{{ t('order.gone') }}</p>
              </div>

              <span class="text-sm text-muted">{{ money(item.priceMinor) }}</span>

              <UButton
                v-if="item.file"
                class="rounded-xl"
                icon="i-pixelarticons-download"
                :label="t('catalog.download')"
                :to="downloadUrl(item.file.id)"
                external
              />
            </li>
          </ul>

          <div class="mt-4 flex items-center justify-between font-medium">
            <span>{{ t('cart.total') }}</span>
            <span>{{ money(data.totalMinor) }}</span>
          </div>

          <p class="mt-8 text-sm text-muted">{{ t('order.keep') }}</p>
        </template>
      </section>
    </div>
  </div>
</template>
