<script setup lang="ts">
const route = useRoute()
const { t, locale } = useI18n()

const id = computed(() => String(route.params.id ?? ''))
const { data, project, refresh } = useProjectEditor(id)

const busy = ref(false)
const saved = ref(false)
const problem = ref('')

const paid = ref(false)
// Euros as typed, cents as stored. Keeping the form in the unit people think in
// and converting once at the edge is what stops 12.30 becoming 1229.
const amount = ref('')

watchEffect(() => {
  if (!project.value) return
  const price = Number(project.value.price ?? 0)
  paid.value = price > 0
  amount.value = price > 0 ? (price / 100).toFixed(2) : ''
})

const terms = computed(() => data.value?.pricing
  ?? { rateBps: 800, minFeeMinor: 50, minPriceMinor: 300 })

const priceMinor = computed(() => {
  const parsed = Number(String(amount.value).replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.round(parsed * 100)
})

const money = (minor: number) => new Intl.NumberFormat(locale.value, {
  style: 'currency',
  currency: 'EUR',
}).format(minor / 100)

// The same function the checkout will charge with, so this is the arithmetic
// rather than a description of it.
const fee = computed(() =>
  feeFor(priceMinor.value, terms.value.rateBps, terms.value.minFeeMinor))

const net = computed(() => priceMinor.value - fee.value)

const tooCheap = computed(() =>
  paid.value && priceMinor.value > 0 && priceMinor.value < terms.value.minPriceMinor)

const canSave = computed(() =>
  !paid.value || (priceMinor.value > 0 && !tooCheap.value))

async function save() {
  busy.value = true
  problem.value = ''
  try {
    await $fetch(`/api/catalog/project/${encodeURIComponent(project.value!.slug)}`, {
      method: 'PATCH',
      body: { price: paid.value ? priceMinor.value : 0 },
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
    <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.projectTabs.pricing') }}</h2>
    <p class="mb-5 text-sm text-muted">{{ t('catalog.settingsHint.pricing') }}</p>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <div class="space-y-5">
      <USwitch v-model="paid" :label="t('catalog.pricing.paid')" />

      <template v-if="paid">
        <UFormField
          :label="t('catalog.pricing.price')"
          :help="t('catalog.pricing.minimum', { amount: money(terms.minPriceMinor) })"
          :error="tooCheap ? t('catalog.pricing.tooCheap', { amount: money(terms.minPriceMinor) }) : undefined"
        >
          <UInput v-model="amount" class="w-40" inputmode="decimal" placeholder="4.99">
            <template #trailing><span class="text-sm text-muted">EUR</span></template>
          </UInput>
        </UFormField>

        <!-- The arithmetic rather than a percentage to trust: a floor on the fee
             means the rate alone does not tell an author what they get. -->
        <div v-if="priceMinor > 0 && !tooCheap" class="rounded-2xl border border-default p-4">
          <p class="text-sm font-medium">{{ t('catalog.pricing.breakdown') }}</p>

          <dl class="mt-3 space-y-1.5 text-sm">
            <div class="flex items-center justify-between gap-4">
              <dt class="text-muted">{{ t('catalog.pricing.buyerPays') }}</dt>
              <dd>{{ money(priceMinor) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4">
              <dt class="text-muted">
                {{ t('catalog.pricing.fee', { rate: (terms.rateBps / 100).toFixed(terms.rateBps % 100 ? 2 : 0) }) }}
              </dt>
              <dd>− {{ money(fee) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 border-t border-default pt-1.5 font-medium">
              <dt>{{ t('catalog.pricing.youGet') }}</dt>
              <dd>{{ money(net) }}</dd>
            </div>
          </dl>

          <p class="mt-3 text-xs text-muted">{{ t('catalog.pricing.feeNote') }}</p>
        </div>

        <p class="text-sm text-muted">{{ t('catalog.pricing.payoutNote') }}</p>
      </template>

      <p v-else class="text-sm text-muted">{{ t('catalog.pricing.freeNote') }}</p>
    </div>

    <div class="mt-5 flex items-center gap-3">
      <UButton
        class="rounded-xl"
        :label="t('account.save')"
        :loading="busy"
        :disabled="!canSave"
        @click="save()"
      />
      <span v-if="saved" class="text-sm text-primary">{{ t('account.saved') }}</span>
    </div>
  </div>
</template>
