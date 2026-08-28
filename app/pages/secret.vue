<script setup lang="ts">
const localePath = useLocalePath()
const { t } = useI18n()
const session = useAuthSession()

const code = ref('')
const busy = ref(false)
const won = ref<{ slug: string, name: string, image: string | null } | null>(null)
const missed = ref(false)

const signedIn = computed(() => Boolean(session.value.data))

async function submit() {
  if (!code.value.trim() || busy.value) return

  busy.value = true
  won.value = null
  missed.value = false

  try {
    const res = await $fetch<{ ok: boolean, badge?: { slug: string, name: string, image: string | null } }>(
      '/api/secret', { method: 'POST', body: { code: code.value } })

    if (res.ok && res.badge) {
      won.value = res.badge
      code.value = ''
    }
    else {
      missed.value = true
    }
  }
  catch {
    missed.value = true
  }
  finally {
    busy.value = false
  }
}

useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
useSeoMeta({ title: () => `${t('secret.title')}`, robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-md px-4 pb-24 pt-40">
        <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-8 text-center backdrop-blur-sm">
          <span class="inline-flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <UIcon name="i-lucide-terminal" class="size-6 text-primary" />
          </span>

          <h1 class="mt-4 text-2xl font-semibold tracking-tight">{{ t('secret.title') }}</h1>
          <p class="mt-2 text-sm/relaxed text-muted">{{ t('secret.sub') }}</p>

          <template v-if="won">
            <div class="mt-6 rounded-2xl border border-primary/40 bg-primary/10 p-5">
              <img v-if="won.image" :src="won.image" :alt="won.name" class="mx-auto mb-3 size-16 object-contain">
              <UIcon v-else name="i-lucide-award" class="mb-3 size-10 text-primary" />
              <p class="font-semibold">{{ t('secret.won', { name: won.name }) }}</p>
            </div>
            <UButton
              :to="localePath(`/badges/${won.slug}`)"
              class="mt-4 rounded-xl"
              size="lg"
              color="neutral"
              variant="outline"
              :label="t('secret.seeBadge')"
            />
          </template>

          <template v-else-if="!signedIn">
            <p class="mt-6 text-sm text-muted">{{ t('secret.signIn') }}</p>
            <UButton
              :to="localePath('/login')"
              class="mt-4 rounded-xl"
              size="lg"
              color="neutral"
              :label="t('auth.signIn')"
            />
          </template>

          <form v-else class="mt-6 space-y-3" @submit.prevent="submit">
            <UInput
              v-model="code"
              size="xl"
              class="w-full"
              :maxlength="64"
              :placeholder="t('secret.placeholder')"
              :ui="{ base: 'text-center font-mono tracking-[0.2em]' }"
            />
            <UButton
              type="submit"
              block
              size="lg"
              color="neutral"
              :loading="busy"
              :disabled="!code.trim()"
              :label="t('secret.submit')"
            />
            <p v-if="missed" class="text-sm text-muted">{{ t('secret.nope') }}</p>
          </form>
        </div>
      </section>
    </div>
  </div>
</template>
