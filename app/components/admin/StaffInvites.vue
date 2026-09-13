<script setup lang="ts">
interface Invite {
  id: string
  role: string
  inviter: string
  created: number
  expires: number
  status: string
  answered: number | null
  user: { id: string, username: string | null, email: string | null, image: string | null, role: string | null }
}

const props = defineProps<{ canInvite: boolean }>()

const { t, locale } = useI18n()
const toast = useToast()
const { ask } = useConfirm()

const { data, refresh } = await useFetch<{ invites: Invite[] }>('/api/admin/staff/invites')

const invites = computed(() => data.value?.invites ?? [])
const open = computed(() => invites.value.filter(invite => invite.status === 'pending'))
const answered = computed(() => invites.value.filter(invite => invite.status !== 'pending'))

const username = ref('')
const role = ref<'moderator' | 'admin'>('moderator')
const busy = ref('')
const problem = ref('')

const ROLES = [
  { label: 'moderator', value: 'moderator' },
  { label: 'admin', value: 'admin' },
]

const when = (ms: number | null) =>
  (ms ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(ms)) : '—')

async function run(key: string, fn: () => Promise<unknown>) {
  busy.value = key
  problem.value = ''
  try { await fn() }
  catch (e: any) { problem.value = e?.data?.statusMessage || t('auth.genericError') }
  finally { busy.value = '' }
}

const invite = () => run('invite', async () => {
  const name = username.value.trim()
  if (!name) return

  await $fetch('/api/admin/staff/invites', {
    method: 'POST',
    body: { username: name, role: role.value },
  })

  username.value = ''
  await refresh()
  toast.add({ title: t('staff.sent', { name }), icon: 'i-pixelarticons-check' })
})

const revoke = (row: Invite) => run(`revoke:${row.id}`, async () => {
  const ok = await ask({
    title: t('staff.revokeAsk'),
    body: row.user.username ?? row.user.id,
    danger: true,
  })
  if (!ok) return

  await $fetch(`/api/admin/staff/invites/${row.id}`, { method: 'DELETE' })
  await refresh()
})

const STATUS_COLOR: Record<string, string> = {
  accepted: 'success',
  declined: 'neutral',
  revoked: 'neutral',
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPanel class="p-5 sm:p-6">
      <h3 class="text-lg font-bold text-highlighted">{{ t('staff.inviteTitle') }}</h3>
      <p class="mt-1 text-sm text-muted">{{ t('staff.inviteHint') }}</p>

      <form v-if="props.canInvite" class="mt-4 flex flex-wrap items-end gap-2" @submit.prevent="invite">
        <UFormField :label="t('staff.nick')" class="min-w-56 flex-1">
          <UInput v-model="username" size="lg" class="w-full" placeholder="makotopd">
            <template #leading>
              <UIcon name="i-pixelarticons-user" class="size-4 text-dimmed" />
            </template>
          </UInput>
        </UFormField>

        <UFormField :label="t('staff.role')">
          <USelect v-model="role" :items="ROLES" size="lg" class="w-40" />
        </UFormField>

        <UButton
          type="submit"
          size="lg"
          icon="i-pixelarticons-mail"
          :loading="busy === 'invite'"
          :disabled="!username.trim()"
          :label="t('staff.invite')"
        />
      </form>

      <p v-else class="mt-4 text-sm text-dimmed">{{ t('staff.ownerOnly') }}</p>

      <p v-if="problem" class="mt-3 text-sm text-error">{{ problem }}</p>
    </UiPanel>

    <UiPanel v-if="open.length" class="overflow-hidden">
      <div class="border-b border-panel-line px-5 py-3">
        <h3 class="text-sm font-semibold uppercase tracking-[0.09em] text-dimmed">
          {{ t('staff.pending', { n: open.length }) }}
        </h3>
      </div>

      <div
        v-for="row in open"
        :key="row.id"
        class="flex flex-wrap items-center gap-3 border-b border-raised-line px-5 py-3 last:border-b-0"
      >
        <img v-if="row.user.image" :src="row.user.image" alt="" class="size-8 shrink-0 rounded-full object-cover">
        <span
          v-else
          class="grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold"
          :style="`background:hsl(${initialsAvatar(row.user.username || row.user.email || '?').hue} 60% 30%)`"
        >{{ initialsAvatar(row.user.username || row.user.email || '?').letter }}</span>

        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-highlighted">{{ row.user.username ?? row.user.id }}</p>
          <p class="truncate text-xs text-dimmed">{{ t('staff.invitedBy', { who: row.inviter || '—' }) }}</p>
        </div>

        <UBadge size="sm" variant="subtle" :label="row.role" />
        <span class="text-xs text-dimmed">{{ t('staff.expires', { date: when(row.expires) }) }}</span>

        <UButton
          v-if="props.canInvite"
          size="xs"
          color="error"
          variant="ghost"
          icon="i-pixelarticons-close"
          :loading="busy === `revoke:${row.id}`"
          :label="t('staff.revoke')"
          @click="revoke(row)"
        />
      </div>
    </UiPanel>

    <UiPanel v-if="answered.length" class="overflow-hidden">
      <div class="border-b border-panel-line px-5 py-3">
        <h3 class="text-sm font-semibold uppercase tracking-[0.09em] text-dimmed">
          {{ t('staff.history') }}
        </h3>
      </div>

      <div
        v-for="row in answered"
        :key="row.id"
        class="flex flex-wrap items-center gap-3 border-b border-raised-line px-5 py-2.5 text-sm last:border-b-0"
      >
        <span class="min-w-0 flex-1 truncate text-muted">{{ row.user.username ?? row.user.id }}</span>
        <UBadge size="sm" variant="subtle" :label="row.role" />
        <UBadge
          size="sm"
          variant="subtle"
          :color="STATUS_COLOR[row.status] ?? 'neutral'"
          :label="t(`staff.status.${row.status}`)"
        />
        <span class="text-xs text-dimmed">{{ when(row.answered) }}</span>
      </div>
    </UiPanel>
  </div>
</template>
