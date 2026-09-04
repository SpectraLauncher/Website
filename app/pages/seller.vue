<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t } = useI18n()
const localePath = useLocalePath()

interface Standing {
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  country: string | null
}

interface Status {
  account: Standing | null
  organizations: Array<{ slug: string, name: string, seller: Standing | null }>
  partner: boolean
  currencies: string[]
}

const { data, refresh } = await useFetch<Status>('/api/seller/status')

const busy = ref('')
const problem = ref('')

async function onboard(orgSlug?: string) {
  busy.value = orgSlug ?? 'self'
  problem.value = ''
  try {
    const res = await $fetch<{ url: string }>('/api/seller/onboard', {
      method: 'POST',
      body: { orgSlug },
    })
    // Stripe hosts onboarding; the link is single use and expires quickly.
    await navigateTo(res.url, { external: true })
  } catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('seller.failed')
    busy.value = ''
  }
}

function stateOf(seller: Standing | null) {
  if (!seller) return 'none'
  if (seller.chargesEnabled) return 'ready'
  if (seller.detailsSubmitted) return 'review'
  return 'started'
}

const STATE_COLOR: Record<string, 'success' | 'warning' | 'neutral'> = {
  ready: 'success',
  review: 'warning',
  started: 'warning',
  none: 'neutral',
}

onMounted(() => refresh())

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
          icon="i-lucide-triangle-alert"
          :description="problem"
        />

        <div class="mt-8 space-y-4">
          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
            <div class="flex flex-wrap items-center gap-3">
              <UIcon name="i-lucide-user" class="size-5 shrink-0 text-dimmed" />
              <span class="min-w-0 flex-1 font-medium">{{ t('seller.ownAccount') }}</span>
              <UBadge
                variant="subtle"
                size="sm"
                :color="STATE_COLOR[stateOf(data?.account ?? null)]"
                :label="t(`seller.states.${stateOf(data?.account ?? null)}`)"
              />
              <UButton
                v-if="stateOf(data?.account ?? null) !== 'ready'"
                size="sm"
                :loading="busy === 'self'"
                :label="data?.account ? t('seller.continue') : t('seller.start')"
                @click="onboard()"
              />
            </div>
            <p class="mt-3 text-sm text-dimmed">
              {{ t(data?.partner ? 'seller.ratePartner' : 'seller.rateStandard') }}
            </p>
          </div>

          <div
            v-for="org in data?.organizations ?? []"
            :key="org.slug"
            class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
          >
            <div class="flex flex-wrap items-center gap-3">
              <UIcon name="i-lucide-users" class="size-5 shrink-0 text-dimmed" />
              <NuxtLink
                :to="localePath(`/org/${org.slug}`)"
                class="min-w-0 flex-1 truncate font-medium hover:underline"
              >{{ org.name }}</NuxtLink>
              <UBadge
                variant="subtle"
                size="sm"
                :color="STATE_COLOR[stateOf(org.seller)]"
                :label="t(`seller.states.${stateOf(org.seller)}`)"
              />
              <UButton
                v-if="stateOf(org.seller) !== 'ready'"
                size="sm"
                :loading="busy === org.slug"
                :label="org.seller ? t('seller.continue') : t('seller.start')"
                @click="onboard(org.slug)"
              />
            </div>
          </div>
        </div>

        <div class="mt-8 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <h2 class="text-lg font-semibold">{{ t('seller.howTitle') }}</h2>
          <ul class="mt-3 space-y-2 text-sm text-muted">
            <li class="flex gap-2">
              <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-primary" />
              {{ t('seller.howStripe') }}
            </li>
            <li class="flex gap-2">
              <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-primary" />
              {{ t('seller.howDirect') }}
            </li>
            <li class="flex gap-2">
              <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-primary" />
              {{ t('seller.howLicence') }}
            </li>
          </ul>
          <NuxtLink
            :to="localePath('/verification')"
            class="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <UIcon name="i-lucide-badge-check" class="size-4" />
            {{ t('seller.applyReduced') }}
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
