<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const auth = useAuthClient()
const { data: release } = useLauncherVersion()

const { data: config } = await useFetch<{ providers: string[], turnstileSiteKey: string }>('/api/auth-providers')

const PROVIDER_META: Record<string, { icon: string, label: string }> = {
  discord: { icon: 'i-simple-icons-discord', label: 'Discord' },
  google: { icon: 'i-simple-icons-google', label: 'Google' },
  github: { icon: 'i-simple-icons-github', label: 'GitHub' },
  microsoft: { icon: 'i-simple-icons-microsoft', label: 'Microsoft' }
}

const providers = computed(() =>
  (config.value?.providers ?? [])
    .filter(id => PROVIDER_META[id])
    .map(id => ({ id, ...PROVIDER_META[id]! })))

type Mode = 'signin' | 'signup' | 'twofactor' | 'forgot' | 'verify'
const mode = ref<Mode>(route.query.mode === 'signup' ? 'signup' : 'signin')

const form = reactive({ email: '', password: '', username: '', code: '' })
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const sent = ref('')

const captchaToken = ref('')
const captcha = ref<{ reset: () => void } | null>(null)
const captchaOn = computed(() => !!config.value?.turnstileSiteKey)
const captchaHeaders = computed(() =>
  captchaToken.value ? { 'x-captcha-response': captchaToken.value } : {})
const blocked = computed(() => loading.value || (captchaOn.value && !captchaToken.value))

const next = computed(() => safeNext(route.query.next, localePath('/account')))

const isSignForm = computed(() => mode.value === 'signin' || mode.value === 'signup')

async function run(fn: () => Promise<any>) {
  loading.value = true
  error.value = ''
  sent.value = ''
  try {
    const res = await fn()
    if (res?.error) error.value = res.error.message || t('auth.genericError')
    return res
  }
  catch (e: any) {
    error.value = e?.message || t('auth.genericError')
  }
  finally {
    loading.value = false
    captcha.value?.reset()
  }
}

async function signIn() {
  const res = await run(() => auth.signIn.email(
    { email: form.email, password: form.password },
    { headers: captchaHeaders.value }
  ))
  if (res?.error) return
  if (res?.data?.twoFactorRedirect) return void (mode.value = 'twofactor')
  await navigateTo(next.value)
}

async function signUp() {
  const res = await run(() => auth.signUp.email(
    {
      email: form.email,
      password: form.password,
      name: form.username,
      username: form.username
    },
    { headers: captchaHeaders.value }
  ))
  if (res?.error) return
  if (!res?.data?.token) return void (mode.value = 'verify')
  await navigateTo(next.value)
}

async function resendVerification() {
  const res = await run(() => auth.sendVerificationEmail({
    email: form.email,
    callbackURL: next.value
  }))
  if (!res?.error) sent.value = t('auth.verifyResent')
}

async function verify() {
  const res = await run(() => auth.twoFactor.verifyTotp({ code: form.code }))
  if (!res?.error) await navigateTo(next.value)
}

async function forgot() {
  const res = await run(() => auth.requestPasswordReset(
    { email: form.email, redirectTo: `${location.origin}${localePath('/reset-password')}` },
    { headers: captchaHeaders.value }
  ))
  if (!res?.error) sent.value = t('auth.resetSent')
}

const social = (provider: string) =>
  auth.signIn.social({ provider: provider as any, callbackURL: next.value })

const pitch = computed(() => [
  { icon: 'i-lucide-package-check', text: t('auth.pitch1') },
  { icon: 'i-lucide-refresh-cw', text: t('auth.pitch2') },
  { icon: 'i-lucide-users', text: t('auth.pitch3') }
])

useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
useSeoMeta({ title: () => `${t('auth.title')}`, robots: 'noindex, follow' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>
      <div
        class="pointer-events-none absolute left-1/2 top-16 -z-10 size-[420px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style="background: radial-gradient(circle, rgba(99,102,241,0.9), transparent 65%)"
      ></div>

      <section class="container mx-auto grid items-center gap-14 px-4 pb-24 pt-40 lg:grid-cols-[1fr_minmax(380px,430px)]">
        <div class="hidden lg:block">
          <UBadge variant="subtle" color="neutral" size="lg" class="mb-6" :label="t('auth.badge')" />

          <h2 class="mb-8 text-4xl font-semibold tracking-tight">
            {{ t('auth.pitchTitle') }}
            <span class="text-primary">{{ t('auth.pitchTitleAccent') }}</span>
          </h2>

          <ul class="space-y-4">
            <li v-for="item in pitch" :key="item.icon" class="flex items-start gap-3">
              <span class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <UIcon :name="item.icon" class="size-[18px] text-primary" />
              </span>
              <p class="max-w-md text-sm/relaxed text-muted">{{ item.text }}</p>
            </li>
          </ul>

          <p v-if="release?.version" class="mt-10 font-mono text-xs text-dimmed">
            Spectra Launcher {{ release.version }}
          </p>
        </div>

        <div class="rounded-3xl border border-zinc-600/50 bg-black/40 p-6 backdrop-blur-sm sm:p-8">
          <template v-if="isSignForm">
            <div class="mb-7 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
              <button
                v-for="tab in (['signin', 'signup'] as const)"
                :key="tab"
                type="button"
                class="cursor-pointer rounded-lg py-2 text-sm font-semibold transition-colors"
                :class="mode === tab ? 'bg-white/10 text-default' : 'text-muted hover:text-default'"
                @click="mode = tab"
              >
                {{ tab === 'signin' ? t('auth.signIn') : t('auth.signUp') }}
              </button>
            </div>

            <h1 class="text-2xl font-semibold tracking-tight">
              {{ mode === 'signup' ? t('auth.signUpTitle') : t('auth.signInTitle') }}
            </h1>
            <p class="mt-1 text-sm text-muted">{{ t('auth.subtitle') }}</p>
          </template>

          <template v-else-if="mode === 'verify'">
            <div class="text-center">
              <span class="inline-flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <UIcon name="i-lucide-mail-check" class="size-6 text-primary" />
              </span>
              <h1 class="mt-4 text-2xl font-semibold tracking-tight">{{ t('auth.verifyTitle') }}</h1>
              <p class="mt-2 text-sm/relaxed text-muted">{{ t('auth.verifyBody') }}</p>
              <p class="mt-3 break-all rounded-xl bg-white/5 px-3 py-2 text-sm font-medium">{{ form.email }}</p>
              <p class="mt-3 text-xs/relaxed text-dimmed">{{ t('auth.verifySpam') }}</p>
            </div>
          </template>

          <template v-else>
            <UButton
              variant="link"
              color="neutral"
              size="sm"
              class="mb-4 -ml-2"
              icon="i-lucide-arrow-left"
              :label="t('auth.backToSignIn')"
              @click="mode = 'signin'"
            />
            <h1 class="text-2xl font-semibold tracking-tight">
              {{ mode === 'twofactor' ? t('auth.twoFactorTitle') : t('auth.forgotTitle') }}
            </h1>
            <p class="mt-1 text-sm text-muted">
              {{ mode === 'twofactor' ? t('auth.twoFactorHint') : t('auth.forgotHint') }}
            </p>
          </template>

          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            class="mt-5"
            icon="i-lucide-circle-alert"
            :description="error"
          />
          <UAlert
            v-if="sent"
            color="success"
            variant="subtle"
            class="mt-5"
            icon="i-lucide-mail-check"
            :description="sent"
          />

          <template v-if="providers.length && isSignForm">
            <div class="mt-6 grid grid-cols-2 gap-2">
              <UButton
                v-for="p in providers"
                :key="p.id"
                variant="outline"
                color="neutral"
                block
                :icon="p.icon"
                :label="p.label"
                @click="social(p.id)"
              />
            </div>

            <div class="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-dimmed">
              <span class="h-px flex-1 bg-white/10" />{{ t('auth.or') }}<span class="h-px flex-1 bg-white/10" />
            </div>
          </template>

          <div v-if="mode === 'verify'" class="mt-7 space-y-2">
            <UButton
              block
              variant="outline"
              color="neutral"
              :loading="loading"
              :label="t('auth.verifyResend')"
              @click="resendVerification"
            />
            <UButton block variant="ghost" color="neutral" :label="t('auth.backToSignIn')" @click="mode = 'signin'" />
          </div>

          <form v-else-if="mode === 'twofactor'" class="mt-6 space-y-4" @submit.prevent="verify">
            <UInput
              v-model="form.code"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="000000"
              size="xl"
              :ui="{ base: 'text-center font-mono text-2xl tracking-[0.4em]' }"
            />
            <UButton type="submit" block size="lg" color="neutral" :loading="loading" :label="t('auth.verify')" />
          </form>

          <form v-else-if="mode === 'forgot'" class="mt-6 space-y-3" @submit.prevent="forgot">
            <UInput
              v-model="form.email"
              type="email"
              autocomplete="email"
              icon="i-lucide-mail"
              size="lg"
              :placeholder="t('auth.email')"
              class="w-full"
            />
            <TurnstileWidget
              v-if="captchaOn"
              ref="captcha"
              :site-key="config!.turnstileSiteKey"
              @token="captchaToken = $event"
            />
            <UButton type="submit" block size="lg" color="neutral" :disabled="blocked" :loading="loading" :label="t('auth.sendReset')" />
          </form>

          <form v-else class="mt-6 space-y-3" @submit.prevent="mode === 'signup' ? signUp() : signIn()">
            <UInput
              v-if="mode === 'signup'"
              v-model="form.username"
              autocomplete="username"
              icon="i-lucide-at-sign"
              size="lg"
              :placeholder="t('auth.username')"
              class="w-full"
            />
            <UInput
              v-model="form.email"
              type="email"
              autocomplete="email"
              icon="i-lucide-mail"
              size="lg"
              :placeholder="t('auth.email')"
              class="w-full"
            />
            <UInput
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
              icon="i-lucide-lock"
              size="lg"
              :placeholder="t('auth.password')"
              class="w-full"
            >
              <template #trailing>
                <UButton
                  variant="link"
                  color="neutral"
                  size="xs"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="t('auth.togglePassword')"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>

            <p v-if="mode === 'signup'" class="text-xs text-dimmed">{{ t('auth.passwordRule') }}</p>

            <TurnstileWidget
              v-if="captchaOn"
              ref="captcha"
              :site-key="config!.turnstileSiteKey"
              @token="captchaToken = $event"
            />

            <UButton
              type="submit"
              block
              size="lg"
              color="neutral"
              :disabled="blocked"
              :loading="loading"
              :label="mode === 'signup' ? t('auth.signUp') : t('auth.signIn')"
            />

            <div class="flex items-center justify-between pt-1 text-sm">
              <button
                type="button"
                class="cursor-pointer text-muted transition-colors hover:text-default"
                @click="mode = mode === 'signup' ? 'signin' : 'signup'"
              >
                {{ mode === 'signup' ? t('auth.haveAccount') : t('auth.noAccount') }}
              </button>
              <button
                v-if="mode === 'signin'"
                type="button"
                class="cursor-pointer text-muted transition-colors hover:text-default"
                @click="mode = 'forgot'"
              >
                {{ t('auth.forgot') }}
              </button>
            </div>
          </form>

          <p v-if="mode === 'signup'" class="mt-5 text-center text-xs/relaxed text-dimmed">
            {{ t('auth.terms') }}
            <i18n-t keypath="auth.legal" tag="span" scope="global">
              <template #terms>
                <NuxtLink :to="localePath('/terms')" class="underline underline-offset-2 hover:text-default">{{ t('terms.title') }}</NuxtLink>
              </template>
              <template #privacy>
                <NuxtLink :to="localePath('/privacy')" class="underline underline-offset-2 hover:text-default">{{ t('privacy.title') }}</NuxtLink>
              </template>
            </i18n-t>
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
