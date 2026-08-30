<script setup lang="ts">

const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthClient()
const session = useAuthSession()

// A one-time token signs the launcher in as this account, so it is minted on an
// explicit click — never on page load. Otherwise any link to this page would
// hand a session to whatever app claimed the `spectra://` scheme.
const state = ref<'idle' | 'working' | 'ready' | 'error'>('idle')
const deepLink = ref('')
const me = computed(() => session.value.data?.user as any)

async function handOff() {
  state.value = 'working'

  const res = await auth.oneTimeToken.generate().catch(() => null)
  const token = (res?.data as any)?.token

  if (!token) return void (state.value = 'error')

  deepLink.value = `spectra://auth/${token}`
  state.value = 'ready'
  window.location.href = deepLink.value
}

watchEffect(() => {
  if (!import.meta.client || session.value.isPending) return

  if (!session.value.data) {
    navigateTo(`${localePath('/login')}?next=${encodeURIComponent(localePath('/launcher/auth'))}`)
  }
})

useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
useSeoMeta({ title: () => `${t('launcherAuth.title')}`, robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-md px-4 pb-24 pt-40">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/40 p-6 backdrop-blur-sm sm:p-8">
          <div class="text-center">
            <div class="flex items-center justify-center gap-3">
              <img src="/logo-transparent.png" width="38" height="38" alt="" />
              <UIcon
                :name="state === 'error' ? 'i-lucide-x' : 'i-lucide-arrow-right'"
                class="size-4"
                :class="state === 'error' ? 'text-red-400' : 'text-dimmed'"
              />
              <span class="flex size-[38px] items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <UIcon
                  :name="state === 'working' ? 'i-lucide-loader-circle' : 'i-lucide-monitor'"
                  class="size-[18px]"
                  :class="state === 'working' ? 'animate-spin text-muted' : state === 'error' ? 'text-red-400' : 'text-primary'"
                />
              </span>
            </div>

            <h1 class="mt-5 text-2xl font-semibold tracking-tight">{{ t('launcherAuth.title') }}</h1>
            <p class="mt-1.5 text-sm text-muted">
              {{ state === 'error' ? t('launcherAuth.failed') : t('launcherAuth.hint') }}
            </p>
          </div>

          <div v-if="me" class="mt-6 flex items-center gap-3 rounded-xl bg-white/5 px-3.5 py-3">
            <img v-if="me.image" :src="me.image" alt="" class="size-9 rounded-full object-cover">
            <span
              v-else
              class="flex size-9 items-center justify-center rounded-full text-sm font-bold"
              :style="`background:hsl(${initialsAvatar(me.username || me.name).hue} 60% 30%)`"
            >{{ initialsAvatar(me.username || me.name).letter }}</span>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ me.username || me.name }}</p>
              <p class="truncate text-xs text-dimmed">{{ t('launcherAuth.signedInAs') }}</p>
            </div>

            <UIcon v-if="state === 'ready'" name="i-lucide-check" class="size-4 text-primary" />
          </div>

          <template v-if="state === 'idle' || state === 'working'">
            <p class="mt-5 flex gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3.5 py-3 text-xs/relaxed text-muted">
              <UIcon name="i-lucide-shield-alert" class="mt-0.5 size-4 shrink-0 text-amber-400" />
              <span>{{ t('launcherAuth.warning') }}</span>
            </p>

            <UButton
              block
              size="lg"
              color="neutral"
              class="mt-4"
              icon="i-lucide-check"
              :loading="state === 'working'"
              :disabled="!me || state === 'working'"
              :label="t('launcherAuth.authorize')"
              @click="handOff"
            />
          </template>

          <template v-if="state === 'ready'">
            <UButton
              :to="deepLink"
              external
              block
              size="lg"
              color="neutral"
              class="mt-5"
              icon="i-lucide-external-link"
              :label="t('launcherAuth.openAgain')"
            />
            <p class="mt-3 text-center text-xs text-dimmed">{{ t('launcherAuth.closeHint') }}</p>
          </template>

          <UButton
            v-if="state === 'error'"
            :to="localePath('/account')"
            block
            size="lg"
            variant="outline"
            color="neutral"
            class="mt-5"
            :label="t('account.title')"
          />
        </div>
      </section>
    </div>
  </div>
</template>
