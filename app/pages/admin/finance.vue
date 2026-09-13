<script setup lang="ts">
interface Totals {
  grossMinor: number
  feeMinor: number
  pendingMinor: number
  transferredMinor: number
  sales: number
}

interface MonthPoint { month: string, grossMinor: number, feeMinor: number }

interface Payout {
  id: string
  userId: string
  username: string | null
  email: string | null
  amountMinor: number
  status: string
  note: string
  requested: number
  settled: number | null
}

definePageMeta({ middleware: 'admin', layout: 'admin' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

const { data } = await useFetch<{
  totals: Totals
  months: MonthPoint[]
  payouts: Payout[]
  commission: { rateBps: number }
}>('/api/admin/finance')

const totals = computed(() => data.value?.totals)
const months = computed(() => data.value?.months ?? [])
const payouts = computed(() => data.value?.payouts ?? [])

const money = (minor: number | undefined) =>
  new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'EUR' })
    .format((minor ?? 0) / 100)

const when = (ms: number | null) =>
  (ms ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms)) : '—')

const FIGURES = computed(() => [
  { id: 'gross', value: money(totals.value?.grossMinor), icon: 'i-pixelarticons-credit-card' },
  { id: 'fee', value: money(totals.value?.feeMinor), icon: 'i-pixelarticons-coin' },
  { id: 'pending', value: money(totals.value?.pendingMinor), icon: 'i-pixelarticons-clock' },
  { id: 'transferred', value: money(totals.value?.transferredMinor), icon: 'i-pixelarticons-check' },
])

// The bars are drawn against the tallest month, so an empty run of months does
// not divide by zero and a single month does not fill the whole panel.
const peak = computed(() => Math.max(1, ...months.value.map(point => point.grossMinor)))

const monthLabel = (month: string) => {
  const [year, m] = month.split('-')
  return new Intl.DateTimeFormat(locale.value, { month: 'short' })
    .format(new Date(Number(year), Number(m) - 1, 1))
}

const STATUS_COLOR: Record<string, string> = {
  requested: 'warning',
  paid: 'success',
  settled: 'success',
  rejected: 'error',
  failed: 'error',
}

useSeoMeta({ title: () => t('finance.title'), robots: 'noindex' })
</script>

<template>
  <div class="min-w-0">
    <UiPageHeader :title="t('finance.title')" :description="t('finance.lead')">
      <div class="flex flex-wrap gap-2 pb-1.5">
        <UButton
          size="lg"
          color="neutral"
          icon="i-pixelarticons-download"
          :label="t('finance.export')"
          external
          to="/api/admin/finance/payouts.csv"
        />
      </div>
    </UiPageHeader>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <UiPanel v-for="figure in FIGURES" :key="figure.id" inset class="p-4">
        <div class="mb-2 flex items-center gap-2 text-dimmed">
          <UIcon :name="figure.icon" class="size-4" />
          <span class="text-xs uppercase tracking-[0.1em]">{{ t(`finance.figures.${figure.id}`) }}</span>
        </div>
        <p class="font-mono text-2xl font-semibold tabular-nums">{{ figure.value }}</p>
        <p class="mt-1 text-xs text-muted">{{ t(`finance.figureHints.${figure.id}`) }}</p>
      </UiPanel>
    </div>

    <UiPanel class="mt-4 p-5 sm:p-6">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <h2 class="text-lg font-bold text-highlighted">{{ t('finance.perMonth') }}</h2>
        <span class="font-mono text-xs text-dimmed">
          {{ t('finance.sales', { n: totals?.sales ?? 0 }) }}
        </span>
      </div>

      <div v-if="months.length" class="mt-5 flex h-40 items-end gap-2">
        <div v-for="point in months" :key="point.month" class="flex flex-1 flex-col items-center gap-2">
          <div class="flex w-full flex-1 items-end">
            <div
              class="w-full rounded-t bg-primary/70 transition-colors hover:bg-primary"
              :style="{ height: `${Math.max(2, (point.grossMinor / peak) * 100)}%` }"
              :title="`${point.month}: ${money(point.grossMinor)}`"
            ></div>
          </div>
          <span class="text-[10px] uppercase tracking-wide text-dimmed">{{ monthLabel(point.month) }}</span>
        </div>
      </div>

      <p v-else class="mt-5 text-sm text-dimmed">{{ t('finance.noSales') }}</p>
    </UiPanel>

    <UiPanel class="mt-4 overflow-hidden">
      <div class="flex flex-wrap items-baseline justify-between gap-3 p-5 sm:p-6">
        <h2 class="text-lg font-bold text-highlighted">{{ t('finance.payouts') }}</h2>
        <span class="font-mono text-xs text-dimmed">{{ payouts.length }}</span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[40rem] text-sm">
          <thead>
            <tr class="border-y border-panel-line text-left text-xs uppercase tracking-[0.09em] text-dimmed">
              <th class="px-5 py-3 font-semibold">{{ t('finance.creator') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('finance.requested') }}</th>
              <th class="px-5 py-3 font-semibold">{{ t('finance.status') }}</th>
              <th class="px-5 py-3 text-right font-semibold">{{ t('finance.amount') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payout in payouts" :key="payout.id" class="border-b border-raised-line last:border-b-0">
              <td class="px-5 py-3">
                <span class="font-medium text-highlighted">{{ payout.username ?? payout.userId }}</span>
                <span v-if="payout.email" class="block truncate text-xs text-dimmed">{{ payout.email }}</span>
              </td>
              <td class="whitespace-nowrap px-5 py-3 text-xs text-muted">{{ when(payout.requested) }}</td>
              <td class="px-5 py-3">
                <UBadge
                  size="sm"
                  variant="subtle"
                  :color="STATUS_COLOR[payout.status] ?? 'neutral'"
                  :label="payout.status"
                />
              </td>
              <td class="whitespace-nowrap px-5 py-3 text-right font-mono tabular-nums">
                {{ money(payout.amountMinor) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="!payouts.length" class="p-12 text-center text-sm text-dimmed">
        {{ t('finance.noPayouts') }}
      </p>
    </UiPanel>
  </div>
</template>
