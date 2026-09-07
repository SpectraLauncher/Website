<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

const { data } = await useFetch<{
  totals: Record<string, { gross: number, fee: number, net: number, count: number }>
  rate: number
  connected: boolean
  sales: Array<{
    id: string
    title: string | null
    amount: number
    fee: number
    currency: string
    completed: number | null
  }>
}>('/api/catalog/me/revenue')

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(locale.value, { style: 'currency', currency: currency.toUpperCase() })
    .format(amount / 100)

const when = (ms: number | null) =>
  ms ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms)) : ''

const { data: ledger, refresh: refreshLedger } = await useFetch<{
  balances: Array<{ currency: string, earned: number, commission: number, paidOut: number, available: number }>
  entries: Array<{ id: string, kind: string, amount: number, currency: string, note: string, created: number }>
  payouts: Array<{ id: string, amount: number, currency: string, status: string, requested: number }>
  minimum: number
}>('/api/seller/ledger')

const asking = ref('')
const askError = ref('')

async function requestPayout(currency: string, available: number) {
  asking.value = currency
  askError.value = ''
  try {
    await $fetch('/api/seller/payout', {
      method: 'POST',
      body: { currency, amount: available },
    })
    await refreshLedger()
  }
  catch (e: any) {
    askError.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    asking.value = ''
  }
}

const KIND_COLOR: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  sale: 'success',
  commission: 'neutral',
  refund: 'error',
  payout: 'warning',
  adjustment: 'neutral',
}

useSeoMeta({ title: () => t('nav.account.revenue'), robots: 'noindex' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-4xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight">{{ t('nav.account.revenue') }}</h1>
        <p class="mt-3 text-base/relaxed text-muted">
          {{ t('account.revenueIntro', { rate: (data?.rate ?? 0.01) * 100 }) }}
        </p>

        <UAlert
          v-if="!data?.connected"
          color="warning"
          variant="subtle"
          class="mt-6 rounded-2xl"
          icon="i-pixelarticons-warning-box"
          :title="t('account.notConnected')"
          :description="t('account.notConnectedBody')"
        >
          <template #actions>
            <UButton size="sm" :to="localePath('/seller')" :label="t('seller.start')" />
          </template>
        </UAlert>

        <div v-if="Object.keys(data?.totals ?? {}).length" class="mt-8 grid gap-4 sm:grid-cols-2">
          <div
            v-for="(totals, currency) in data!.totals"
            :key="currency"
            class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
          >
            <p class="text-sm text-dimmed">{{ String(currency).toUpperCase() }}</p>
            <p class="mt-1 text-3xl font-semibold">{{ money(totals.net, String(currency)) }}</p>
            <p class="mt-2 text-xs text-dimmed">
              {{ t('account.grossAndFee', {
                gross: money(totals.gross, String(currency)),
                fee: money(totals.fee, String(currency)),
              }) }}
            </p>
          </div>
        </div>

        <ul v-if="data?.sales.length" class="mt-6 space-y-2">
          <li
            v-for="sale in data.sales"
            :key="sale.id"
            class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <span class="min-w-0 flex-1 truncate text-sm">{{ sale.title ?? '—' }}</span>
            <span class="text-xs text-dimmed">{{ when(sale.completed) }}</span>
            <span class="text-sm font-medium">{{ money(sale.amount - sale.fee, sale.currency) }}</span>
          </li>
        </ul>

        <div v-else class="mt-10 rounded-3xl border border-zinc-600/50 bg-black/30 p-12 text-center backdrop-blur-sm">
          <UIcon name="i-pixelarticons-wallet" class="mx-auto size-10 text-dimmed" />
          <p class="mt-3 text-sm text-muted">{{ t('account.noSales') }}</p>
        </div>
      </section>

      <section v-if="ledger" class="mt-12">
        <h2 class="mb-4 text-lg font-semibold">{{ t('ledger.title') }}</h2>

        <UAlert v-if="askError" color="error" variant="subtle" class="mb-4 rounded-2xl" :description="askError" />

        <div v-if="ledger.balances.length" class="mb-6 grid gap-3 sm:grid-cols-2">
          <div
            v-for="balance in ledger.balances"
            :key="balance.currency"
            class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
          >
            <p class="text-xs text-dimmed">{{ t('ledger.available') }}</p>
            <p class="text-2xl font-semibold">{{ money(balance.available, balance.currency) }}</p>
            <p class="mt-1 text-xs text-dimmed">
              {{ t('ledger.summary', {
                earned: money(balance.earned, balance.currency),
                commission: money(-balance.commission, balance.currency),
                paidOut: money(-balance.paidOut, balance.currency),
              }) }}
            </p>

            <UButton
              class="mt-3 rounded-xl"
              size="sm"
              color="neutral"
              icon="i-pixelarticons-banknote"
              :disabled="balance.available < ledger.minimum"
              :loading="asking === balance.currency"
              :label="t('ledger.request')"
              @click="requestPayout(balance.currency, balance.available)"
            />
            <p v-if="balance.available < ledger.minimum" class="mt-1 text-xs text-dimmed">
              {{ t('ledger.minimum', { amount: money(ledger.minimum, balance.currency) }) }}
            </p>
          </div>
        </div>

        <ul v-if="ledger.payouts.length" class="mb-6 space-y-2">
          <li
            v-for="payout in ledger.payouts"
            :key="payout.id"
            class="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm"
          >
            <UIcon name="i-pixelarticons-banknote" class="size-4 shrink-0 text-muted" />
            <span class="font-medium">{{ money(payout.amount, payout.currency) }}</span>
            <UBadge size="sm" variant="subtle" :label="t(`ledger.statuses.${payout.status}`)" />
            <span class="flex-1"></span>
            <span class="text-xs text-dimmed">{{ when(payout.requested) }}</span>
          </li>
        </ul>

        <ul v-if="ledger.entries.length" class="space-y-1">
          <li
            v-for="entry in ledger.entries"
            :key="entry.id"
            class="flex flex-wrap items-center gap-3 border-b border-white/5 py-2 text-sm"
          >
            <UBadge
              size="sm"
              variant="subtle"
              :color="KIND_COLOR[entry.kind] ?? 'neutral'"
              :label="t(`ledger.kinds.${entry.kind}`)"
            />
            <span class="min-w-0 flex-1 truncate text-xs text-dimmed">{{ entry.note }}</span>
            <span :class="entry.amount < 0 ? 'text-dimmed' : 'font-medium'">
              {{ money(entry.amount, entry.currency) }}
            </span>
            <span class="text-xs text-dimmed">{{ when(entry.created) }}</span>
          </li>
        </ul>

        <p v-else class="text-sm text-dimmed">{{ t('ledger.empty') }}</p>
      </section>
    </div>
  </div>
</template>
