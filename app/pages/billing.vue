<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

interface Seller { chargesEnabled: boolean, payoutsEnabled: boolean, detailsSubmitted: boolean, country: string | null }

// Three views of the same money, already served elsewhere; this page is the
// place they are read together rather than a fourth copy of the logic.
const [{ data: seller }, { data: revenue }, { data: library }] = await Promise.all([
  useFetch<{
    account: Seller | null
    organizations: Array<{ slug: string, name: string, seller: Seller | null }>
    partner: boolean
  }>('/api/seller/status'),
  useFetch<{
    totals: Record<string, { gross: number, fee: number, net: number, count: number }>
    rate: number
    connected: boolean
  }>('/api/catalog/me/revenue'),
  useFetch<{ items: Array<{ id: string, amount: number, currency: string }> }>('/api/catalog/library'),
])

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(locale.value, { style: 'currency', currency: currency.toUpperCase() })
    .format(amount / 100)

const spent = computed(() => {
  const by: Record<string, number> = {}
  for (const item of library.value?.items ?? []) {
    by[item.currency] = (by[item.currency] ?? 0) + item.amount
  }
  return by
})

const earned = computed(() => Object.entries(revenue.value?.totals ?? {}))

const ready = computed(() => seller.value?.account?.payoutsEnabled === true)

useSeoMeta({ title: () => t('billing.title'), robots: 'noindex' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="mx-auto max-w-4xl px-4 pb-24 pt-40">
        <h1 class="mb-2 text-2xl font-semibold tracking-tight">{{ t('billing.title') }}</h1>
        <p class="mb-8 text-sm text-muted">{{ t('billing.intro') }}</p>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <h2 class="mb-1 text-sm font-semibold">{{ t('billing.earned') }}</h2>
            <p class="mb-4 text-xs text-dimmed">
              {{ t('billing.commission', { rate: ((revenue?.rate ?? 0) * 100).toFixed(1) }) }}
            </p>

            <ul v-if="earned.length" class="space-y-1">
              <li v-for="[currency, total] in earned" :key="currency" class="text-lg font-medium">
                {{ money(total.net, currency) }}
                <span class="text-xs text-dimmed">{{ t('billing.ofGross', { gross: money(total.gross, currency) }) }}</span>
              </li>
            </ul>
            <p v-else class="text-sm text-dimmed">{{ t('billing.nothingYet') }}</p>

            <UButton
              class="mt-4 rounded-xl"
              size="sm"
              variant="ghost"
              color="neutral"
              trailing-icon="i-pixelarticons-arrow-right"
              :to="localePath('/revenue')"
              :label="t('nav.account.revenue')"
            />
          </div>

          <div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <h2 class="mb-1 text-sm font-semibold">{{ t('billing.spent') }}</h2>
            <p class="mb-4 text-xs text-dimmed">
              {{ t('billing.purchases', { n: library?.items.length ?? 0 }) }}
            </p>

            <ul v-if="Object.keys(spent).length" class="space-y-1">
              <li v-for="(total, currency) in spent" :key="currency" class="text-lg font-medium">
                {{ money(total, String(currency)) }}
              </li>
            </ul>
            <p v-else class="text-sm text-dimmed">{{ t('billing.nothingYet') }}</p>

            <UButton
              class="mt-4 rounded-xl"
              size="sm"
              variant="ghost"
              color="neutral"
              trailing-icon="i-pixelarticons-arrow-right"
              :to="localePath('/library')"
              :label="t('nav.account.library')"
            />
          </div>
        </div>

        <div class="mt-4 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
          <div class="mb-3 flex flex-wrap items-center gap-3">
            <h2 class="text-sm font-semibold">{{ t('billing.payouts') }}</h2>
            <UBadge
              size="sm"
              variant="subtle"
              :color="ready ? 'success' : 'warning'"
              :label="ready ? t('billing.payoutsReady') : t('billing.payoutsPending')"
            />
            <UBadge
              v-if="seller?.partner"
              size="sm"
              variant="subtle"
              :label="t('billing.partner')"
            />
          </div>

          <p class="mb-4 text-xs text-muted">{{ t('billing.payoutsHint') }}</p>

          <ul v-if="seller?.organizations.length" class="mb-4 space-y-2">
            <li
              v-for="org in seller.organizations"
              :key="org.slug"
              class="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm"
            >
              <span class="min-w-0 flex-1 truncate">{{ org.name }}</span>
              <UBadge
                size="sm"
                variant="subtle"
                :color="org.seller?.payoutsEnabled ? 'success' : 'warning'"
                :label="org.seller?.payoutsEnabled ? t('billing.payoutsReady') : t('billing.payoutsPending')"
              />
            </li>
          </ul>

          <UButton
            class="rounded-xl"
            size="sm"
            variant="ghost"
            color="neutral"
            trailing-icon="i-pixelarticons-arrow-right"
            :to="localePath('/seller')"
            :label="t('billing.manage')"
          />
        </div>
      </section>
    </div>
  </div>
</template>
