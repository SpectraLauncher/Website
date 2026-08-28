<script setup lang="ts">

const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthClient()
const session = useAuthSession()

const state = ref<'working' | 'ready' | 'error'>('working')
const deepLink = ref('')
const me = computed(() => session.value.data?.user as any)

async function handOff() {
  const res = await auth.oneTimeToken.generate()
  const token = (res.data as any)?.token

  if (!token) return void (state.value = 'error')

  deepLink.value = `spectra://auth/${token}`
  state.value = 'ready'
  window.location.href = deepLink.value
}

watchEffect(() => {
  if (!import.meta.client || session.value.isPending || state.value !== 'working') return

  if (!session.value.data) {
    navigateTo(`${localePath('/login')}?next=${encodeURIComponent(localePath('/launcher/auth'))}`)
    return
  }

  handOff()
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
              <NuxtImg src="/logo-transparent.png" width="38" height="38" alt="" />
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
