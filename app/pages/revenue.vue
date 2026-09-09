<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

interface Entry {
  id: string
  kind: string
  state: string
  amountMinor: number
  shareBps: number | null
  title: string | null
  note: string
  created: number
}

interface Payout {
  id: string
  amountMinor: number
  status: string
  note: string
  requested: number
}

const { data, refresh } = await useFetch<{
  balance: { pendingMinor: number, transferredMinor: number }
  available: number
  minimum: number
  payouts: Payout[]
  entries: Entry[]
}>('/api/seller/ledger')

const busy = ref(false)
const problem = ref('')

const money = (minor: number) => new Intl.NumberFormat(locale.value, {
  style: 'currency',
  currency: 'EUR',
}).format(minor / 100)

const when = (ms: number) => new Date(ms).toLocaleDateString(locale.value)

const canPayOut = computed(() =>
  (data.value?.available ?? 0) >= (data.value?.minimum ?? Infinity))

const owes = computed(() => (data.value?.balance.pendingMinor ?? 0) < 0)

async function payout() {
  busy.value = true
  problem.value = ''
  try {
    await $fetch('/api/seller/payout', { method: 'POST', body: {} })
    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('revenue.failed')
  }
  finally { busy.value = false }
}

useSeoMeta({ title: () => t('revenue.title'), robots: 'noindex' })
</script>

<template>
  <div>
    <SiteNavbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-3xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight">{{ t('revenue.title') }}</h1>

        <UAlert
          v-if="problem"
          color="error"
          variant="subtle"
          class="mt-6 rounded-2xl"
          icon="i-pixelarticons-warning-box"
          :description="problem"
        />

        <div v-if="data" class="mt-8 grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl border border-default p-4">
            <p class="text-sm text-muted">{{ t('revenue.pending') }}</p>
            <p class="mt-1 text-2xl font-semibold">{{ money(data.balance.pendingMinor) }}</p>
            <!-- Negative means a chargeback is still being worked off. Later
                 sales net against it before anything moves. -->
            <p v-if="owes" class="mt-2 text-sm text-warning">{{ t('revenue.owing') }}</p>
            <p v-else class="mt-2 text-sm text-muted">{{ t('revenue.pendingHint') }}</p>
          </div>

          <div class="rounded-2xl border border-default p-4">
            <p class="text-sm text-muted">{{ t('revenue.available') }}</p>
            <p class="mt-1 text-2xl font-semibold">{{ money(data.available) }}</p>
            <p class="mt-2 text-sm text-muted">
              {{ t('revenue.minimum', { amount: money(data.minimum) }) }}
            </p>

            <UButton
              class="mt-3 rounded-xl"
              :loading="busy"
              :disabled="!canPayOut"
              :label="t('revenue.payout')"
              @click="payout()"
            />
          </div>
        </div>

        <p class="mt-6 text-sm text-muted">
          {{ t('revenue.sellerHint') }}
          <NuxtLink :to="localePath('/seller')" class="underline">{{ t('revenue.sellerLink') }}</NuxtLink>
        </p>

        <h2 class="mt-10 text-lg font-semibold">{{ t('revenue.ledger') }}</h2>

        <p v-if="!data?.entries.length" class="mt-3 text-muted">{{ t('revenue.noEntries') }}</p>

        <ul v-else class="mt-3 divide-y divide-default rounded-2xl border border-default">
          <li v-for="entry in data.entries" :key="entry.id" class="flex items-center gap-3 p-4">
            <div class="flex-1">
              <p class="font-medium">{{ entry.title || t(`revenue.kind.${entry.kind}`) }}</p>
              <p class="text-sm text-muted">
                {{ when(entry.created) }} · {{ t(`revenue.state.${entry.state}`) }}
                <template v-if="entry.shareBps !== null && entry.shareBps < 10000">
                  · {{ (entry.shareBps / 100).toFixed(0) }}%
                </template>
              </p>
            </div>
            <span :class="entry.amountMinor < 0 ? 'text-error' : ''">
              {{ money(entry.amountMinor) }}
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
