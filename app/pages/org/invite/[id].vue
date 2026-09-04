<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthClient()
const session = useAuthSession()

const id = computed(() => String(route.params.id ?? ''))

const busy = ref('')
const problem = ref('')
const accepted = ref<{ slug: string } | null>(null)

const signedIn = computed(() => Boolean(session.value.data?.user))

async function accept() {
  busy.value = 'accept'
  problem.value = ''
  try {
    const res = await auth.organization.acceptInvitation({ invitationId: id.value })
    if (res.error) throw new Error(res.error.message || t('catalog.org.inviteFailed'))

    // Accepting has already happened by this point. The follow-up only supplies
    // a slug for the link, so it must never turn a successful join into an error.
    const full = await auth.organization.getFullOrganization({
      query: { organizationId: res.data?.member?.organizationId },
    }).catch(() => null)

    accepted.value = { slug: full?.data?.slug ?? '' }
  } catch (e: any) {
    problem.value = e?.message || t('catalog.org.inviteFailed')
  } finally { busy.value = '' }
}

async function reject() {
  busy.value = 'reject'
  problem.value = ''
  try {
    await auth.organization.rejectInvitation({ invitationId: id.value })
    await navigateTo(localePath('/'))
  } catch (e: any) {
    problem.value = e?.message || t('catalog.org.inviteFailed')
  } finally { busy.value = '' }
}

useSeoMeta({ title: () => t('catalog.org.inviteTitle'), robots: 'noindex' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto flex max-w-lg flex-col items-center px-4 py-40 text-center">
        <span class="grid size-16 place-items-center rounded-2xl border border-white/10 bg-white/5">
          <UIcon name="i-lucide-mail-open" class="size-7 text-primary" />
        </span>

        <h1 class="mt-6 text-2xl font-semibold tracking-tight">
          {{ t('catalog.org.inviteTitle') }}
        </h1>

        <template v-if="accepted">
          <p class="mt-3 text-muted">{{ t('catalog.org.inviteAccepted') }}</p>
          <UButton
            v-if="accepted.slug"
            class="mt-6"
            size="lg"
            :to="localePath(`/org/${accepted.slug}`)"
            :label="t('catalog.org.openOrg')"
          />
        </template>

        <template v-else-if="!signedIn">
          <p class="mt-3 text-muted">{{ t('catalog.org.inviteSignIn') }}</p>
          <UButton
            class="mt-6"
            size="lg"
            :to="localePath({ path: '/login', query: { next: route.fullPath } })"
            :label="t('catalog.org.signIn')"
          />
        </template>

        <template v-else>
          <p class="mt-3 text-muted">{{ t('catalog.org.inviteBody') }}</p>

          <UAlert
            v-if="problem"
            color="error"
            variant="subtle"
            class="mt-5 rounded-2xl text-left"
            icon="i-lucide-triangle-alert"
            :description="problem"
          />

          <div class="mt-6 flex gap-3">
            <UButton
              size="lg"
              :loading="busy === 'accept'"
              :label="t('catalog.org.acceptInvite')"
              @click="accept"
            />
            <UButton
              size="lg"
              variant="ghost"
              color="neutral"
              :loading="busy === 'reject'"
              :label="t('catalog.org.rejectInvite')"
              @click="reject"
            />
          </div>
        </template>
      </section>
    </div>
  </div>
</template>
