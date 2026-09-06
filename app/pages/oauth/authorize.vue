<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const session = useAuthSession()

useHead({ title: () => t('oauth.title') })
useSeoMeta({ robots: 'noindex,nofollow' })

const info = ref<{
  client: { id: string, name: string, icon: string | null }
  scopes: string[]
  redirect: string
  state: string
  known: boolean
} | null>(null)

const error = ref('')
const busy = ref('')

watchEffect(() => {
  if (import.meta.client && !session.value.isPending && !session.value.data) {
    navigateTo({ path: localePath('/login'), query: { next: route.fullPath } })
  }
})

onMounted(async () => {
  try {
    const res = await $fetch<any>('/api/oauth/authorize', { query: route.query })
    // A refusal that still has somewhere to go sends the application its answer
    // rather than stranding the person on this page.
    if (res.error && res.redirect) {
      window.location.href = res.redirect
      return
    }
    info.value = res
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
})

async function decide(approve: boolean) {
  if (!info.value) return

  busy.value = approve ? 'approve' : 'deny'
  try {
    const res = await $fetch<{ redirect: string }>('/api/oauth/authorize', {
      method: 'POST',
      body: {
        clientId: info.value.client.id,
        redirectUri: info.value.redirect,
        scope: info.value.scopes.join(' '),
        state: info.value.state,
        approve,
      },
    })
    window.location.href = res.redirect
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
    busy.value = ''
  }
}

const host = computed(() => {
  try {
    return new URL(info.value!.redirect).host
  }
  catch {
    return info.value?.redirect ?? ''
  }
})
</script>

<template>
  <section class="mx-auto flex min-h-[70vh] max-w-lg items-center px-4 py-12">
    <div class="w-full">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        class="rounded-2xl"
        icon="i-lucide-triangle-alert"
        :description="error"
      />

      <div
        v-else-if="info"
        class="rounded-3xl border border-zinc-600/50 bg-black/30 p-8 backdrop-blur-sm"
      >
        <div class="mb-6 flex flex-wrap items-center gap-4">
          <span class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <img v-if="info.client.icon" :src="info.client.icon" alt="" class="size-full object-cover">
            <UIcon v-else name="i-lucide-boxes" class="size-6 text-dimmed" />
          </span>
          <div class="min-w-0">
            <h1 class="truncate text-xl font-semibold tracking-tight">{{ info.client.name }}</h1>
            <p class="text-sm text-muted">{{ t('oauth.asks') }}</p>
          </div>
        </div>

        <ul class="mb-6 space-y-2">
          <li
            v-for="scope in info.scopes"
            :key="scope"
            class="flex items-start gap-2 text-sm"
          >
            <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-primary" />
            <span class="text-muted">{{ t(`tokens.scopes.${scope}`) }}</span>
          </li>
        </ul>

        <p class="mb-6 break-words text-xs text-dimmed">
          {{ t('oauth.returnsTo', { host }) }}
        </p>

        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            size="lg"
            class="flex-1 justify-center rounded-xl"
            :loading="busy === 'approve'"
            :label="info.known ? t('oauth.continue') : t('oauth.allow')"
            @click="decide(true)"
          />
          <UButton
            variant="ghost"
            color="neutral"
            size="lg"
            class="rounded-xl"
            :loading="busy === 'deny'"
            :label="t('oauth.deny')"
            @click="decide(false)"
          />
        </div>

        <p class="mt-4 text-xs text-dimmed">{{ t('oauth.revokeLater') }}</p>
      </div>
    </div>
  </section>
</template>
