<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
const session = useAuthSession()
const { items, unread, loaded, refresh, markRead, dismiss } = useNotifications()

useHead({ title: () => t('nav.account.notifications') })

watchEffect(() => {
  if (import.meta.client && !session.value.isPending && !session.value.data) {
    navigateTo(localePath('/login'))
  }
})

onMounted(refresh)

const when = (ms: number) => new Date(ms).toLocaleString(locale.value)

function target(item: NotificationItem): string | null {
  if (item.project) return localePath(item.project.path)
  if (item.actor?.username) return localePath(`/u/${item.actor.username}`)
  return null
}

function line(item: NotificationItem): string {
  const actor = item.actor?.name || item.actor?.username || t('notifications.someone')
  return t(`notifications.${item.kind}`, { actor, project: item.project?.title ?? '' })
}
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-12">
    <div class="mb-8 flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('nav.account.notifications') }}</h1>
      <UBadge v-if="unread" :label="String(unread)" variant="subtle" />
      <span class="flex-1"></span>
      <UButton
        v-if="unread"
        size="sm"
        variant="ghost"
        color="neutral"
        icon="i-lucide-check-check"
        :label="t('notifications.markAll')"
        @click="markRead()"
      />
    </div>

    <ul v-if="items.length" class="space-y-2">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex items-start gap-3 rounded-2xl border p-4 transition-colors"
        :class="item.read ? 'border-white/10 bg-white/[0.02]' : 'border-primary/30 bg-primary/5'"
      >
        <UIcon :name="notificationIcon(item.kind)" class="mt-0.5 size-5 shrink-0 text-muted" />

        <div class="min-w-0 flex-1">
          <component
            :is="target(item) ? 'NuxtLink' : 'span'"
            :to="target(item) ?? undefined"
            class="block text-sm"
            :class="target(item) ? 'hover:underline' : ''"
            @click="!item.read && markRead([item.id])"
          >
            {{ line(item) }}
          </component>
          <p class="mt-1 text-xs text-dimmed">{{ when(item.created) }}</p>
        </div>

        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-x"
          :aria-label="t('notifications.dismiss')"
          @click="dismiss(item.id)"
        />
      </li>
    </ul>

    <p v-else-if="loaded" class="rounded-2xl border border-white/10 p-10 text-center text-sm text-dimmed">
      {{ t('notifications.empty') }}
    </p>
  </section>
</template>
