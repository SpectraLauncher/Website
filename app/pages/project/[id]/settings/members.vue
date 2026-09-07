<script setup lang="ts">
interface Member {
  userId: string
  username: string | null
  name: string | null
  image: string | null
  permissions: ProjectPermission[]
  added: number
}

interface Inherited {
  userId: string
  role: string
  username: string | null
  name: string | null
  image: string | null
}

const route = useRoute()
const { t } = useI18n()
const { ask } = useConfirm()
const localePath = useLocalePath()

const id = computed(() => String(route.params.id ?? ''))
const { project, refresh: refreshProject } = useProjectEditor(id)

const busy = ref('')
const problem = ref('')

const path = computed(() => `/api/catalog/project/${encodeURIComponent(project.value?.slug ?? '')}`)

const request = useRequestFetch()

const { data, refresh } = await useAsyncData(
  `project-members:${id.value}`,
  () => request<{
    members: Member[]
    owner: { kind: 'user' | 'organization', slug: string | null, name: string | null, image: string | null } | null
    inherited: Inherited[]
    mine: ProjectPermission[]
    isOwner: boolean
  }>(`/api/catalog/project/${encodeURIComponent(id.value)}/members`),
  { watch: [id] },
)

const may = (permission: ProjectPermission) => Boolean(data.value?.mine.includes(permission))

const invitee = ref('')

async function add() {
  if (!invitee.value.trim()) return

  busy.value = 'add'
  problem.value = ''
  try {
    await $fetch(`${path.value}/members`, {
      method: 'POST',
      body: { username: invitee.value.trim() },
    })
    invitee.value = ''
    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = '' }
}

async function remove(member: Member) {
  const ok = await ask({
    title: t('catalog.confirmRemoveMember', { name: member.username || member.name }),
    confirmLabel: t('catalog.org.remove'),
    danger: true,
  })
  if (!ok) return

  busy.value = member.userId
  try {
    await $fetch(`${path.value}/members/${member.userId}`, { method: 'DELETE' })
    await refresh()
  }
  catch (e: any) { problem.value = e?.data?.statusMessage || t('auth.genericError') }
  finally { busy.value = '' }
}

// Handing the project to a group. Only organizations the caller belongs to are
// offered, and the server checks that again.
const organizations = ref<Array<{ id: string, name: string, logo?: string | null }>>([])
const target = ref('')

onMounted(async () => {
  try {
    const res = await $fetch<{ organizations: typeof organizations.value }>('/api/org/mine')
    organizations.value = res.organizations
  }
  catch { organizations.value = [] }
})

const orgOptions = computed(() => organizations.value
  .filter(org => org.id !== project.value?.orgId)
  .map(org => ({
    value: org.id,
    label: org.name,
    avatar: org.logo ? { src: org.logo, size: '2xs' as const } : undefined,
    icon: org.logo ? undefined : 'i-pixelarticons-users',
  })))

async function transfer() {
  if (!target.value) return

  const org = organizations.value.find(o => o.id === target.value)
  const ok = await ask({
    title: t('catalog.confirmTransfer', { name: org?.name }),
    body: t('catalog.confirmTransferBody'),
    confirmLabel: t('catalog.transfer'),
    danger: true,
  })
  if (!ok) return

  busy.value = 'transfer'
  problem.value = ''
  try {
    await $fetch(`${path.value}/transfer`, { method: 'POST', body: { orgId: target.value } })
    target.value = ''
    await Promise.all([refresh(), refreshProject()])
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
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

    <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
      <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.projectTabs.members') }}</h2>
      <p class="mb-5 text-sm text-muted">{{ t('catalog.settingsHint.members') }}</p>

      <ul class="space-y-2">
        <!-- The owner is not a row in project_member, so a list built only from
             that table leaves out the person whose project it is. -->
        <li
          v-if="data?.owner"
          class="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3"
        >
          <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5">
            <img v-if="data.owner.image" :src="data.owner.image" alt="" class="size-full object-cover">
            <UIcon
              v-else
              :name="data.owner.kind === 'organization' ? 'i-pixelarticons-users' : 'i-pixelarticons-user'"
              class="size-4 text-dimmed"
            />
          </span>
          <span class="min-w-0 flex-1">
            <NuxtLink
              v-if="data.owner.slug"
              :to="localePath(data.owner.kind === 'organization'
                ? `/org/${data.owner.slug}`
                : `/u/${data.owner.slug}`)"
              class="block truncate text-sm font-medium transition-colors hover:text-highlighted"
            >{{ data.owner.name || data.owner.slug }}</NuxtLink>
            <span v-else class="block truncate text-sm font-medium">—</span>
            <span class="block text-xs text-dimmed">
              {{ data.owner.kind === 'organization' ? t('catalog.organization') : t('catalog.owner') }}
            </span>
          </span>
          <UBadge size="sm" variant="subtle" color="primary" :label="t('catalog.allRights')" />
        </li>

        <li
          v-for="member in data?.inherited ?? []"
          :key="`org-${member.userId}`"
          class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
        >
          <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5">
            <img v-if="member.image" :src="member.image" alt="" class="size-full object-cover">
            <UIcon v-else name="i-pixelarticons-user" class="size-4 text-dimmed" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">
              {{ member.username || member.name || '—' }}
            </span>
            <span class="block text-xs text-dimmed">{{ t('catalog.viaOrganization') }}</span>
          </span>
          <UBadge size="sm" variant="subtle" :label="t(`catalog.org.roles.${member.role}`)" />
        </li>

        <li
          v-for="member in data?.members ?? []"
          :key="member.userId"
          class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
        >
          <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5">
            <img v-if="member.image" :src="member.image" alt="" class="size-full object-cover">
            <UIcon v-else name="i-pixelarticons-user" class="size-4 text-dimmed" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">
              {{ member.username || member.name || '—' }}
            </span>
            <span class="block text-xs text-dimmed">
              {{ member.permissions.length
                ? member.permissions.map(p => t(`projectMembers.permissions.${p}`)).join(', ')
                : t('catalog.noRights') }}
            </span>
          </span>
          <UButton
            v-if="may('remove_member')"
            size="xs"
            variant="ghost"
            color="error"
            icon="i-pixelarticons-user-minus"
            :loading="busy === member.userId"
            :aria-label="t('catalog.org.removeMember')"
            @click="remove(member)"
          />
        </li>
      </ul>

      <div v-if="may('manage_invites')" class="mt-5 border-t border-white/10 pt-4">
        <p class="mb-2 text-sm text-muted">{{ t('catalog.addMemberHint') }}</p>
        <div class="flex flex-wrap gap-2">
          <UInput
            v-model="invitee"
            class="min-w-48 flex-1"
            :placeholder="t('catalog.org.username')"
            @keyup.enter="add"
          />
          <UButton
            class="rounded-xl"
            icon="i-pixelarticons-user-plus"
            :label="t('catalog.addMember')"
            :loading="busy === 'add'"
            @click="add"
          />
        </div>
      </div>
    </div>

    <div
      v-if="data?.isOwner && orgOptions.length"
      class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
    >
      <h2 class="mb-1 text-lg font-semibold">{{ t('catalog.transferTitle') }}</h2>
      <p class="mb-4 text-sm text-muted">{{ t('catalog.settingsHint.transfer') }}</p>

      <div class="flex flex-wrap gap-2">
        <USelect
          v-model="target"
          :items="orgOptions"
          value-key="value"
          :placeholder="t('catalog.pickOrganization')"
          class="min-w-48 flex-1"
        />
        <UButton
          class="rounded-xl"
          color="neutral"
          variant="subtle"
          icon="i-pixelarticons-arrow-right"
          :disabled="!target"
          :loading="busy === 'transfer'"
          :label="t('catalog.transfer')"
          @click="transfer"
        />
      </div>
    </div>
  </div>
</template>
