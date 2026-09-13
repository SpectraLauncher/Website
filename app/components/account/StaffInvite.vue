<script setup lang="ts">
/**
 * The offer, where it can be answered.
 *
 * Shown on the notifications page because that is where both the bell and the
 * e-mail send somebody. Renders nothing when there is no open invitation.
 */
const { t, locale } = useI18n()
const toast = useToast()

const { data, refresh } = await useFetch<{
  invite: { id: string, role: string, inviter: string, expires: number } | null
}>('/api/me/staff-invite')

const invite = computed(() => data.value?.invite ?? null)

const busy = ref('')
const problem = ref('')

const when = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms))

async function answer(accept: boolean) {
  busy.value = accept ? 'accept' : 'decline'
  problem.value = ''

  try {
    await $fetch('/api/me/staff-invite', { method: 'POST', body: { accept } })
    await refresh()

    toast.add({
      title: t(accept ? 'staff.accepted' : 'staff.declined'),
      icon: accept ? 'i-pixelarticons-check' : 'i-pixelarticons-close',
    })

    // The role decides what the navigation offers and is read once at load, so
    // the panel only appears after the app has been rebuilt.
    if (accept) reloadNuxtApp({ force: true })
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = '' }
}
</script>

<template>
  <UiPanel v-if="invite" class="border-primary/40 p-5 sm:p-6">
    <div class="flex flex-wrap items-start gap-4">
      <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <UIcon name="i-pixelarticons-shield" class="size-6" />
      </span>

      <div class="min-w-0 flex-1">
        <h2 class="text-lg font-bold text-highlighted">{{ t('staff.yours') }}</h2>
        <p class="mt-1 text-pretty text-sm text-muted">
          {{ t('staff.yoursBody', { who: invite.inviter || '—', role: invite.role }) }}
        </p>
        <p class="mt-2 text-xs text-dimmed">
          {{ t('staff.expires', { date: when(invite.expires) }) }}
        </p>

        <p v-if="problem" class="mt-2 text-sm text-error">{{ problem }}</p>

        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            icon="i-pixelarticons-check"
            :loading="busy === 'accept'"
            :label="t('staff.accept')"
            @click="answer(true)"
          />
          <UButton
            color="neutral"
            variant="ghost"
            :loading="busy === 'decline'"
            :label="t('staff.decline')"
            @click="answer(false)"
          />
        </div>
      </div>
    </div>
  </UiPanel>
</template>
