<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { ask } = useConfirm()
const localePath = useLocalePath()

const slug = computed(() => String(route.params.slug ?? ''))
const { data, refresh, may } = useOrganization(slug)

const session = useAuthSession()
const myId = computed(() => (session.value.data?.user as { id?: string } | undefined)?.id ?? '')
const myRank = computed(() => data.value?.rank ?? -1)

// A member level with you is not yours to touch, so the row shows nothing
// rather than a control the server would refuse.
const canManage = (member: OrgMember) =>
  member.userId !== myId.value && rankOf(member.role) < myRank.value

const busy = ref('')
const problem = ref('')

const editing = ref<string | null>(null)
const memberRole = ref('member')
const memberPermissions = ref<OrgPermission[]>([])

function openMember(member: OrgMember) {
  editing.value = member.userId
  memberRole.value = member.role
  memberPermissions.value = [...member.permissions]
}

// You cannot hand out what you do not hold, so the rest is not offered.
const permissionChoices = computed(() =>
  ORG_PERMISSION_KEYS.filter(key => may(key))
    .map(key => ({ value: key, label: t(`catalog.org.permissions.${key}`) })))

const roleChoices = computed(() =>
  ORG_ROLES.filter(role => rankOf(role) <= myRank.value)
    .map(role => ({ value: role, label: t(`catalog.org.roles.${role}`) })))

async function saveMember(member: OrgMember) {
  busy.value = member.userId
  problem.value = ''
  try {
    await $fetch(`/api/org/${encodeURIComponent(slug.value)}/members/${member.userId}`, {
      method: 'PATCH',
      body: { role: memberRole.value, permissions: memberPermissions.value },
    })
    editing.value = null
    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = '' }
}

async function removeMember(member: OrgMember) {
  const ok = await ask({
    title: t('catalog.org.confirmRemove', { name: member.username || member.name }),
    confirmLabel: t('catalog.org.remove'),
    danger: true,
  })
  if (!ok) return

  busy.value = member.userId
  problem.value = ''
  try {
    await $fetch(`/api/org/${encodeURIComponent(slug.value)}/members/${member.userId}`, {
      method: 'DELETE',
    })
    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = '' }
}

// Walking out as the last member takes the organization and everything it owns
// with it, so that question is not the same question.
const lastOne = computed(() => (data.value?.members?.length ?? 0) < 2)

async function leave() {
  const ok = await ask({
    title: lastOne.value ? t('catalog.org.confirmLeaveLast') : t('catalog.org.confirmLeave'),
    body: lastOne.value ? t('catalog.org.confirmLeaveLastBody') : undefined,
    confirmLabel: t('catalog.org.leave'),
    danger: true,
  })
  if (!ok) return

  busy.value = 'leave'
  problem.value = ''
  try {
    await $fetch(`/api/org/${encodeURIComponent(slug.value)}/leave`, { method: 'POST' })
    await navigateTo(localePath('/organizations'))
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
    busy.value = ''
  }
}

const invitee = ref('')
const invited = ref(false)

async function invite() {
  if (!invitee.value.trim()) return
  busy.value = 'invite'
  problem.value = ''
  try {
    await $fetch(`/api/org/${encodeURIComponent(slug.value)}/invite`, {
      method: 'POST',
      body: { username: invitee.value.trim() },
    })
    invitee.value = ''
    invited.value = true
    setTimeout(() => (invited.value = false), 5000)
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('catalog.org.saveFailed')
  }
  finally { busy.value = '' }
}
</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <div v-if="may('manage_invites')" class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
      <h2 class="text-lg font-semibold">{{ t('catalog.org.invite') }}</h2>
      <p class="mt-1 text-sm text-muted">{{ t('catalog.org.inviteHint') }}</p>

      <div class="mt-4 flex flex-wrap gap-2">
        <UInput
          v-model="invitee"
          class="min-w-48 flex-1"
          :placeholder="t('catalog.org.username')"
          @keyup.enter="invite"
        />
        <UButton
          class="rounded-xl"
          icon="i-pixelarticons-user-plus"
          :label="t('catalog.org.sendInvite')"
          :loading="busy === 'invite'"
          @click="invite"
        />
      </div>
      <p v-if="invited" class="mt-2 text-sm text-primary">{{ t('catalog.org.inviteSent') }}</p>
    </div>

    <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
      <h2 class="mb-4 text-lg font-semibold">{{ t('catalog.org.members') }}</h2>

      <ul class="space-y-3">
        <li v-for="member in data?.members ?? []" :key="member.userId">
          <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <NuxtLink
              :to="member.username ? localePath(`/u/${member.username}`) : ''"
              class="flex min-w-0 flex-1 items-center gap-3"
            >
              <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5">
                <img v-if="member.image" :src="member.image" alt="" class="size-full object-cover">
                <UIcon v-else name="i-pixelarticons-user" class="size-4 text-dimmed" />
              </span>
              <span class="min-w-0 flex-1 truncate text-sm font-medium">
                {{ member.username || member.name || '—' }}
              </span>
            </NuxtLink>

            <UBadge variant="subtle" size="sm" :label="t(`catalog.org.roles.${member.role}`)" />

            <UButton
              v-if="canManage(member) && may('edit_member')"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-pixelarticons-settings-2"
              :aria-label="t('catalog.org.editMember')"
              @click="editing === member.userId ? editing = null : openMember(member)"
            />
            <UButton
              v-if="canManage(member) && may('remove_member')"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-pixelarticons-user-minus"
              :loading="busy === member.userId"
              :aria-label="t('catalog.org.removeMember')"
              @click="removeMember(member)"
            />
          </div>

          <div
            v-if="editing === member.userId"
            class="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <UFormField :label="t('catalog.org.role')" size="sm">
              <USelect
                v-model="memberRole"
                :items="roleChoices"
                value-key="value"
                size="sm"
                class="w-full"
              />
            </UFormField>

            <p class="mb-2 mt-4 text-xs font-semibold">{{ t('catalog.org.permissions.title') }}</p>
            <p v-if="memberRole === 'owner'" class="text-xs text-dimmed">
              {{ t('catalog.org.ownerHasAll') }}
            </p>
            <UCheckboxGroup
              v-else
              v-model="memberPermissions"
              :items="permissionChoices"
              value-key="value"
              size="sm"
            />

            <div class="mt-4 flex justify-end gap-2">
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                :label="t('catalog.cancel')"
                @click="editing = null"
              />
              <UButton
                size="xs"
                color="neutral"
                :loading="busy === member.userId"
                :label="t('account.save')"
                @click="saveMember(member)"
              />
            </div>
          </div>
        </li>
      </ul>

      <div v-if="data?.role" class="mt-5 border-t border-white/10 pt-4">
        <UButton
          size="sm"
          variant="ghost"
          color="error"
          class="rounded-xl"
          icon="i-pixelarticons-logout"
          :loading="busy === 'leave'"
          :label="t('catalog.org.leave')"
          @click="leave"
        />
        <p v-if="lastOne" class="mt-2 text-xs text-dimmed">{{ t('catalog.org.lastMemberHint') }}</p>
      </div>
    </div>
  </div>
</template>
