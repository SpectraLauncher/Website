<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t } = useI18n()

interface Account {
  country: string | null
  transfersEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  due: string[]
}

interface Status {
  account: Account | null
  countries: string[]
  publishableKey: string
}

const { data, refresh } = await useFetch<Status>('/api/seller/status')

const country = ref('PL')
const busy = ref(false)
const problem = ref('')
const container = ref<HTMLElement | null>(null)
const mounted = ref(false)

const countries = computed(() =>
  (data.value?.countries ?? []).map(code => ({ value: code, label: code })))

const state = computed(() => {
  const account = data.value?.account
  if (!account) return 'none'
  if (account.transfersEnabled) return 'ready'
  if (account.detailsSubmitted) return 'review'
  return 'started'
})

const STATE_COLOR: Record<string, 'success' | 'warning' | 'neutral'> = {
  ready: 'success',
  review: 'warning',
  started: 'warning',
  none: 'neutral',
}

// Connect.js is loaded from Stripe rather than bundled, so the onboarding form
// stays inside this page instead of sending the seller off to a hosted one.
useHead({
  script: [{ src: 'https://connect-js.stripe.com/v1.0/connect.js', async: true }],
})

async function fetchClientSecret(): Promise<string> {
  const res = await $fetch<{ clientSecret: string }>('/api/seller/onboard', {
    method: 'POST',
    body: { country: country.value },
  })
  return res.clientSecret
}

type ConnectGlobal = {
  init: (options: Record<string, unknown>) => {
    create: (name: string) => HTMLElement & {
      setOnExit?: (fn: () => void) => void
      setOnLoadError?: (fn: (e: { error?: { message?: string } }) => void) => void
    }
  }
  onLoad?: () => void
}

// The script announces itself by calling onLoad, but on a client-side
// navigation it has already run and will never call it again - so an instance
// that is already there is used directly.
function whenConnectReady(): Promise<ConnectGlobal> {
  const w = window as unknown as { StripeConnect?: ConnectGlobal }
  if (w.StripeConnect?.init) return Promise.resolve(w.StripeConnect)

  return new Promise((resolve) => {
    w.StripeConnect = w.StripeConnect ?? ({} as ConnectGlobal)
    w.StripeConnect.onLoad = () => resolve(w.StripeConnect as ConnectGlobal)
  })
}

async function startOnboarding() {
  busy.value = true
  problem.value = ''

  try {
    // Called once up front for its side effect: it is what creates the account,
    // and doing it here means a refused country or an unconfigured platform
    // surfaces as our own message rather than inside a Stripe iframe that only
    // says something went wrong. The secret it returns is discarded - Connect.js
    // asks for its own, and needs a fresh one on every refresh anyway.
    await fetchClientSecret()
    const connect = await whenConnectReady()

    const instance = connect.init({
      publishableKey: data.value?.publishableKey ?? '',
      fetchClientSecret,
    })

    const component = instance.create('account-onboarding')
    component.setOnExit?.(() => refresh())
    component.setOnLoadError?.((e) => {
      problem.value = e?.error?.message || t('seller.failed')
    })

    container.value?.replaceChildren(component)
    mounted.value = true
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('seller.failed')
  }
  finally {
    busy.value = false
  }
}

useSeoMeta({ title: () => t('seller.title'), robots: 'noindex' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-3xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight">{{ t('seller.title') }}</h1>
        <p class="mt-3 text-base/relaxed text-muted">{{ t('seller.intro') }}</p>

        <UAlert
          v-if="problem"
          color="error"
          variant="subtle"
          class="mt-6 rounded-2xl"
          icon="i-pixelarticons-warning-box"
          :description="problem"
        />

        <UAlert
          v-if="data && !data.publishableKey"
          color="warning"
          variant="subtle"
          class="mt-6 rounded-2xl"
          icon="i-pixelarticons-warning-box"
          :description="t('seller.notConfigured')"
        />

        <div v-else class="mt-8 space-y-6">
          <div class="rounded-2xl border border-default p-5">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-medium">{{ t('seller.account') }}</p>
                <p class="mt-1 text-sm text-muted">{{ t(`seller.state.${state}`) }}</p>
              </div>
              <UBadge :color="STATE_COLOR[state]" variant="subtle">
                {{ t(`seller.badge.${state}`) }}
              </UBadge>
            </div>

            <!-- Selling never waits on this. Money owed before verification sits
                 as pending and moves once the account can receive it. -->
            <p class="mt-4 text-sm text-muted">{{ t('seller.deferred') }}</p>

            <ul v-if="data?.account?.due?.length" class="mt-4 space-y-1 text-sm text-muted">
              <li v-for="item in data.account.due" :key="item">— {{ item }}</li>
            </ul>
          </div>

          <div v-if="!data?.account && !mounted" class="rounded-2xl border border-default p-5">
            <p class="font-medium">{{ t('seller.country') }}</p>
            <p class="mt-1 text-sm text-muted">{{ t('seller.countryHint') }}</p>

            <div class="mt-4 flex flex-wrap items-center gap-3">
              <USelect v-model="country" :items="countries" value-key="value" class="w-40" />
              <UButton :loading="busy" @click="startOnboarding()">
                {{ t('seller.start') }}
              </UButton>
            </div>
          </div>

          <UButton
            v-else-if="!mounted"
            :loading="busy"
            variant="subtle"
            @click="startOnboarding()"
          >
            {{ t('seller.resume') }}
          </UButton>

          <div ref="container" class="rounded-2xl"></div>
        </div>
      </section>
    </div>

  </div>
</template>
