<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t, locale } = useI18n()
const localePath = useLocalePath()

interface Request {
  id: string
  kind: 'partner' | 'organization'
  orgId: string | null
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
  body: string
  links: Record<string, string>
  reviewNote: string
  reviewedAt: number | null
  created: number
}

interface Mine {
  requests: Request[]
  standing: {
    partner: boolean
    organizations: Array<{ id: string, slug: string, name: string }>
  }
}

const { data, refresh } = await useFetch<Mine>('/api/verification/mine')

const busy = ref('')
const problem = ref('')

const form = reactive({
  kind: 'partner' as 'partner' | 'organization',
  orgSlug: '',
  body: '',
  links: '' as string,
})

const orgs = computed(() => data.value?.standing.organizations ?? [])
const alreadyPartner = computed(() => data.value?.standing.partner === true)

const openKinds = computed(() => {
  const pending = new Set(
    (data.value?.requests ?? []).filter(r => r.status === 'pending')
      .map(r => (r.kind === 'partner' ? 'partner' : `org:${r.orgId}`)))
  return pending
})

const canApplyPartner = computed(() => !alreadyPartner.value && !openKinds.value.has('partner'))

// Links arrive as one line per entry, "name url", because a form with six fixed
// fields fits nobody: a streamer has different proof than a studio.
function parseLinks(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const [name, ...rest] = line.trim().split(/\s+/)
    const url = rest.join(' ')
    if (name && url) out[name] = url
  }
  return out
}

async function submit() {
  busy.value = 'submit'
  problem.value = ''
  try {
    await $fetch('/api/verification', {
      method: 'POST',
      body: {
        kind: form.kind,
        orgSlug: form.kind === 'organization' ? form.orgSlug : undefined,
        body: form.body,
        links: parseLinks(form.links),
      },
    })
    form.body = ''
    form.links = ''
    await refresh()
  } catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('verification.failed')
  } finally { busy.value = '' }
}

async function withdraw(id: string) {
  busy.value = id
  try {
    await $fetch(`/api/verification/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('verification.failed')
  } finally { busy.value = '' }
}

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'error',
}

useSeoMeta({ title: () => t('verification.title'), robots: 'noindex' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-3xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight">{{ t('verification.title') }}</h1>
        <p class="mt-3 text-base/relaxed text-muted">{{ t('verification.intro') }}</p>

        <UAlert
          v-if="problem"
          color="error"
          variant="subtle"
          class="mt-6 rounded-2xl"
          icon="i-pixelarticons-warning-box"
          :description="problem"
        />

        <div
          v-if="data?.requests.length"
          class="mt-8 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
        >
          <h2 class="text-lg font-semibold">{{ t('verification.yourApplications') }}</h2>
          <ul class="mt-4 space-y-3">
            <li
              v-for="request in data.requests"
              :key="request.id"
              class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium">{{ t(`verification.kinds.${request.kind}`) }}</span>
                <UBadge
                  variant="subtle"
                  size="sm"
                  :color="STATUS_COLOR[request.status] ?? 'neutral'"
                  :label="t(`verification.statuses.${request.status}`)"
                />
                <span class="text-xs text-dimmed">{{ when(request.created) }}</span>
                <span class="flex-1"></span>
                <UButton
                  v-if="request.status === 'pending'"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  :loading="busy === request.id"
                  :label="t('verification.withdraw')"
                  @click="withdraw(request.id)"
                />
              </div>
              <p v-if="request.reviewNote" class="mt-2 text-sm text-muted">
                {{ t('verification.moderatorNote') }}: {{ request.reviewNote }}
              </p>
            </li>
          </ul>
        </div>

        <div class="mt-8 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <h2 class="text-lg font-semibold">{{ t('verification.apply') }}</h2>

          <div class="mt-4 space-y-3">
            <USelect
              v-model="form.kind"
              :items="[
                { value: 'partner', label: t('verification.kinds.partner'), disabled: !canApplyPartner },
                { value: 'organization', label: t('verification.kinds.organization'), disabled: !orgs.length },
              ]"
              value-key="value"
            />

            <USelect
              v-if="form.kind === 'organization'"
              v-model="form.orgSlug"
              :items="orgs.map(org => ({ value: org.slug, label: org.name }))"
              value-key="value"
              :placeholder="t('verification.pickOrg')"
            />

            <UTextarea
              v-model="form.body"
              :rows="8"
              class="w-full"
              :placeholder="t('verification.bodyPlaceholder')"
            />

            <UTextarea
              v-model="form.links"
              :rows="4"
              class="w-full font-mono text-sm"
              :placeholder="t('verification.linksPlaceholder')"
            />
          </div>

          <p v-if="alreadyPartner" class="mt-3 text-sm text-success">
            {{ t('verification.alreadyPartner') }}
          </p>
          <p v-else-if="!orgs.length && form.kind === 'organization'" class="mt-3 text-sm text-dimmed">
            {{ t('verification.needOwnedOrg') }}
          </p>

          <UButton
            class="mt-4"
            :loading="busy === 'submit'"
            :disabled="form.body.trim().length < 40
              || (form.kind === 'organization' && !form.orgSlug)
              || (form.kind === 'partner' && !canApplyPartner)"
            :label="t('verification.submit')"
            @click="submit"
          />
        </div>

        <p class="mt-6 text-sm text-dimmed">
          {{ t('verification.rates') }}
          <NuxtLink :to="localePath('/terms')" class="text-primary hover:underline">
            {{ t('verification.terms') }}
          </NuxtLink>
        </p>
      </section>
    </div>
  </div>
</template>
