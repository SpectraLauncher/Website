<script setup lang="ts">
import type { PlatformPolicy } from '~~/shared/utils/platform-policy'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()

const { data, refresh } = await useFetch<{
  policy: PlatformPolicy
  staff: Record<string, number>
  catalogPublic: boolean
}>('/api/admin/platform')

const { data: session } = await useFetch<{ role: string | null }>('/api/admin/session')
const mayEdit = computed(() => isOwner({ role: session.value?.role ?? null }))

const policy = computed(() => data.value?.policy)

const busy = ref('')
const problem = ref('')

// Every knob is a boolean that does something, so the list is the page: one
// entry here renders the row, sends the change and explains the consequence.
const REVIEW = [
  { key: 'submissions', icon: 'i-pixelarticons-inbox' },
  { key: 'scanGate', icon: 'i-pixelarticons-shield' },
] as const

async function set(key: keyof PlatformPolicy, value: boolean) {
  busy.value = key
  problem.value = ''

  try {
    await $fetch('/api/admin/platform', { method: 'PATCH', body: { [key]: value } })
    await refresh()
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally { busy.value = '' }
}

const ROLES = [
  { id: 'owner', icon: 'i-pixelarticons-crown', tone: 'text-amber-400' },
  { id: 'admin', icon: 'i-pixelarticons-user', tone: 'text-primary' },
  { id: 'moderator', icon: 'i-pixelarticons-shield', tone: 'text-dimmed' },
] as const

useSeoMeta({ title: () => t('platform.title'), robots: 'noindex' })
</script>

<template>
  <div class="min-w-0">
    <UiPageHeader :title="t('platform.title')" :description="t('platform.lead')">
      <div class="flex flex-wrap gap-2 pb-1.5">
      </div>
    </UiPageHeader>

    <UAlert
      v-if="problem"
      color="error"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-warning-box"
      :description="problem"
    />

    <UAlert
      v-if="!mayEdit"
      color="neutral"
      variant="subtle"
      class="mb-4 rounded-2xl"
      icon="i-pixelarticons-lock"
      :description="t('platform.ownerOnly')"
    />

    <div class="flex flex-col gap-4">
      <!-- Review policy -->
      <UiPanel class="p-5 sm:p-6">
        <h2 class="text-lg font-bold text-highlighted">{{ t('platform.review') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ t('platform.reviewHint') }}</p>

        <div class="mt-5 flex flex-col divide-y divide-raised-line">
          <div v-for="knob in REVIEW" :key="knob.key" class="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
            <UIcon :name="knob.icon" class="mt-0.5 size-5 shrink-0 text-dimmed" />
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-highlighted">{{ t(`platform.knobs.${knob.key}.label`) }}</p>
              <p class="mt-0.5 text-sm text-muted">{{ t(`platform.knobs.${knob.key}.hint`) }}</p>
            </div>
            <USwitch
              :model-value="policy?.[knob.key] ?? false"
              :disabled="!mayEdit || busy === knob.key"
              @update:model-value="set(knob.key, $event)"
            />
          </div>
        </div>
      </UiPanel>

      <!-- Staff roles: read, not set. A role is something an account has. -->
      <UiPanel class="p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-highlighted">{{ t('platform.roles') }}</h2>
            <p class="mt-1 text-sm text-muted">{{ t('platform.rolesHint') }}</p>
          </div>
          <UButton
            size="sm"
            color="neutral"
            variant="subtle"
            icon="i-pixelarticons-users"
            :label="t('platform.manageRoles')"
            :to="localePath('/admin')"
          />
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          <div
            v-for="role in ROLES"
            :key="role.id"
            class="rounded-xl border border-raised-line bg-raised p-4"
          >
            <div class="flex items-center gap-2">
              <UIcon :name="role.icon" class="size-4" :class="role.tone" />
              <span class="text-sm font-semibold text-highlighted">
                {{ t(`platform.roleNames.${role.id}`) }}
              </span>
            </div>
            <p class="mt-2 font-mono text-2xl font-semibold">{{ data?.staff?.[role.id] ?? 0 }}</p>
            <p class="mt-1 text-xs text-muted">{{ t(`platform.roleScopes.${role.id}`) }}</p>
          </div>
        </div>
      </UiPanel>

      <!-- The catalog flag, shown but not offered -->
      <UiPanel class="p-5 sm:p-6">
        <h2 class="text-lg font-bold text-highlighted">{{ t('platform.flags') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ t('platform.flagsHint') }}</p>

        <div class="mt-5 flex items-center gap-4 rounded-xl border border-raised-line bg-raised p-4">
          <UIcon name="i-pixelarticons-package" class="size-5 shrink-0 text-dimmed" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted">{{ t('platform.catalogFlag') }}</p>
            <p class="mt-0.5 text-sm text-muted">{{ t('platform.catalogFlagHint') }}</p>
          </div>
          <UBadge
            variant="subtle"
            :color="data?.catalogPublic ? 'success' : 'neutral'"
            :label="t(data?.catalogPublic ? 'platform.open' : 'platform.closed')"
          />
        </div>
      </UiPanel>

      <!-- Maintenance, last and on its own: it is the one that stops the site -->
      <UiPanel class="border-error/30 p-5 sm:p-6">
        <div class="flex flex-wrap items-start gap-4">
          <UIcon name="i-pixelarticons-warning-box" class="mt-0.5 size-5 shrink-0 text-error" />
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-bold text-highlighted">{{ t('platform.maintenance') }}</h2>
            <p class="mt-1 text-sm text-muted">{{ t('platform.maintenanceHint') }}</p>
          </div>
          <UButton
            :color="policy?.maintenance ? 'success' : 'error'"
            :variant="policy?.maintenance ? 'solid' : 'subtle'"
            :disabled="!mayEdit"
            :loading="busy === 'maintenance'"
            :icon="policy?.maintenance ? 'i-pixelarticons-play' : 'i-pixelarticons-pause'"
            :label="t(policy?.maintenance ? 'platform.maintenanceOff' : 'platform.maintenanceOn')"
            @click="set('maintenance', !policy?.maintenance)"
          />
        </div>
      </UiPanel>
    </div>
  </div>
</template>
