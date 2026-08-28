<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const auth = useAuthClient()

const token = computed(() => String(route.query.token ?? ''))
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const done = ref(false)

const tooShort = computed(() => password.value.length > 0 && password.value.length < 8)

async function submit() {
  if (password.value.length < 8) return

  loading.value = true
  error.value = ''

  const res = await auth.resetPassword({ newPassword: password.value, token: token.value })

  loading.value = false
  if (res.error) return void (error.value = res.error.message || t('auth.genericError'))
  done.value = true
}

useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
useSeoMeta({ title: () => `${t('auth.resetTitle')}`, robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-md px-4 pb-24 pt-40">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/40 p-6 backdrop-blur-sm sm:p-8">
          <template v-if="done">
            <div class="text-center">
              <span class="inline-flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <UIcon name="i-lucide-check" class="size-6 text-primary" />
              </span>
              <h1 class="mt-4 text-2xl font-semibold tracking-tight">{{ t('auth.resetDoneTitle') }}</h1>
              <p class="mt-2 text-sm/relaxed text-muted">{{ t('auth.resetDone') }}</p>
              <UButton
                :to="localePath('/login')"
                block
                size="lg"
                color="neutral"
                class="mt-6"
                :label="t('auth.signIn')"
              />
            </div>
          </template>

          <template v-else-if="!token">
            <div class="text-center">
              <span class="inline-flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <UIcon name="i-lucide-link-2-off" class="size-6 text-muted" />
              </span>
              <h1 class="mt-4 text-2xl font-semibold tracking-tight">{{ t('auth.resetTitle') }}</h1>
              <p class="mt-2 text-sm/relaxed text-muted">{{ t('auth.resetNoToken') }}</p>
              <UButton
                :to="localePath('/login')"
                block
                size="lg"
                color="neutral"
                variant="outline"
                class="mt-6"
                :label="t('auth.backToSignIn')"
              />
            </div>
          </template>

          <template v-else>
            <h1 class="text-2xl font-semibold tracking-tight">{{ t('auth.resetTitle') }}</h1>
            <p class="mt-1 text-sm text-muted">{{ t('auth.resetHint') }}</p>

            <UAlert
              v-if="error"
              color="error"
              variant="subtle"
              class="mt-5"
              icon="i-lucide-circle-alert"
              :description="error"
            />

            <form class="mt-6 space-y-3" @submit.prevent="submit">
              <UInput
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
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

              <p class="text-xs" :class="tooShort ? 'text-red-400' : 'text-dimmed'">{{ t('auth.passwordRule') }}</p>

              <UButton
                type="submit"
                block
                size="lg"
                color="neutral"
                :disabled="password.length < 8"
                :loading="loading"
                :label="t('auth.setPassword')"
              />
            </form>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
