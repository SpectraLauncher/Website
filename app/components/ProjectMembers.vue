<script setup lang="ts">
interface Member {
  userId: string
  username: string | null
  name: string | null
  image: string | null
  permissions: ProjectPermission[]
  added: number
}

const props = defineProps<{ slug: string }>()

const { t } = useI18n()
const localePath = useLocalePath()

const members = ref<Member[]>([])
const mine = ref<ProjectPermission[]>([])
const owner = ref(false)
const visible = ref(false)

const busy = ref('')
const error = ref('')
const invitee = ref('')
const open = ref<string | null>(null)
const draft = ref<ProjectPermission[]>([])

// A 404 is the normal answer for anyone with no rights on this project, so the
// whole panel stays hidden rather than showing a failure.
async function load() {
  try {
    const res = await $fetch<{ members: Member[], mine: ProjectPermission[], owner: boolean }>(
      `/api/catalog/project/${props.slug}/members`)
    members.value = res.members
    mine.value = res.mine
    owner.value = res.owner
    visible.value = true
  }
  catch {
    visible.value = false
  }
}

onMounted(load)

const may = (permission: ProjectPermission) => mine.value.includes(permission)

async function act(key: string, run: () => Promise<unknown>) {
  busy.value = key
  error.value = ''
  try {
    await run()
    await load()
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = ''
  }
}

function edit(member: Member) {
  open.value = open.value === member.userId ? null : member.userId
  draft.value = [...member.permissions]
}

const save = (member: Member) => act(member.userId, () =>
  $fetch(`/api/catalog/project/${props.slug}/members`, {
    method: 'POST',
    body: { username: member.username, permissions: draft.value },
  }).then(() => { open.value = null }))

const invite = () => act('invite', () =>
  $fetch(`/api/catalog/project/${props.slug}/members`, {
    method: 'POST',
    body: { username: invitee.value.trim(), permissions: [] },
  }).then(() => { invitee.value = '' }))

const remove = (member: Member) => act(member.userId, () =>
  $fetch(`/api/catalog/project/${props.slug}/members/${member.userId}`, { method: 'DELETE' }))
</script>

<template>
  <section
    v-if="visible && (may('edit_member') || members.length)"
    class="mt-10 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm"
  >
    <div class="mb-1 flex flex-wrap items-center gap-2">
      <UIcon name="i-lucide-users" class="size-5 text-muted" />
      <h2 class="text-lg font-semibold">{{ t('projectMembers.title') }}</h2>
    </div>
    <p class="mb-5 text-sm text-muted">{{ t('projectMembers.hint') }}</p>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4 rounded-2xl" :description="error" />

    <ul v-if="members.length" class="mb-5 space-y-2">
      <li v-for="member in members" :key="member.userId">
        <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <span class="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5">
            <img v-if="member.image" :src="member.image" alt="" class="size-full object-cover">
            <UIcon v-else name="i-lucide-user" class="size-4 text-dimmed" />
          </span>

          <NuxtLink
            v-if="member.username"
            :to="localePath(`/u/${member.username}`)"
            class="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
          >
            {{ member.name || member.username }}
          </NuxtLink>
          <span v-else class="min-w-0 flex-1 truncate text-sm font-medium">{{ member.name }}</span>

          <UBadge
            size="sm"
            variant="subtle"
            :label="t('projectMembers.count', { n: member.permissions.length })"
          />

          <UButton
            v-if="may('edit_member')"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-settings-2"
            :aria-label="t('projectMembers.edit')"
            @click="edit(member)"
          />
          <UButton
            v-if="may('remove_member')"
            size="xs"
            variant="ghost"
            color="error"
            icon="i-lucide-user-minus"
            :loading="busy === member.userId"
            :aria-label="t('projectMembers.remove')"
            @click="remove(member)"
          />
        </div>

        <div
          v-if="open === member.userId"
          class="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <p class="mb-3 text-xs text-muted">{{ t('projectMembers.grantHint') }}</p>

          <div class="grid gap-2 sm:grid-cols-2">
            <UCheckbox
              v-for="key in PROJECT_PERMISSION_KEYS"
              :key="key"
              :model-value="draft.includes(key)"
              :disabled="!may(key)"
              :label="t(`projectMembers.permissions.${key}`)"
              size="sm"
              @update:model-value="draft = draft.includes(key)
                ? draft.filter(p => p !== key)
                : [...draft, key]"
            />
          </div>

          <div class="mt-4 flex flex-wrap justify-end gap-2">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              :label="t('catalog.cancel')"
              @click="open = null"
            />
            <UButton
              size="xs"
              color="neutral"
              :loading="busy === member.userId"
              :label="t('account.save')"
              @click="save(member)"
            />
          </div>
        </div>
      </li>
    </ul>

    <p v-else class="mb-5 text-sm text-dimmed">{{ t('projectMembers.none') }}</p>

    <div v-if="may('manage_invites')" class="flex flex-wrap gap-2 border-t border-white/10 pt-4">
      <UInput
        v-model="invitee"
        size="sm"
        class="min-w-0 flex-1"
        icon="i-lucide-at-sign"
        :placeholder="t('auth.username')"
        @keyup.enter="invite"
      />
      <UButton
        size="sm"
        color="neutral"
        class="rounded-xl"
        :disabled="!invitee.trim()"
        :loading="busy === 'invite'"
        :label="t('projectMembers.add')"
        @click="invite"
      />
    </div>
  </section>
</template>
