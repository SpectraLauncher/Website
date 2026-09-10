<script setup lang="ts">
defineProps<{ events: ProfileEvent[] }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

// Registry: one line per event kind. The mark and the tint say at a glance
// whether a row came from the launcher or from the catalog; adding a kind means
// a line here, a branch in `detail` below and a key under profile.feed.
const MARKS: Record<ProfileEvent['kind'], { icon: string, tint: boolean }> = {
  release: { icon: 'i-pixelarticons-arrow-up-box', tint: true },
  publish: { icon: 'i-pixelarticons-package', tint: true },
  org: { icon: 'i-pixelarticons-users', tint: false },
  play: { icon: 'i-pixelarticons-gamepad', tint: false },
}

function subject(event: ProfileEvent): string {
  return event.kind === 'play' ? humanDuration(event.seconds) : event.title
}

function detail(event: ProfileEvent): string {
  if (event.kind === 'release') {
    return [gameVersionRange(event.gameVersions), event.loaders.join(' · ')]
      .filter(Boolean).join(' · ')
  }
  if (event.kind === 'publish') return t(`catalog.admin.types.${event.type}`)
  if (event.kind === 'org') return event.role
  return t('activity.launches', { n: event.launches })
}
</script>

<template>
  <UiPanel class="overflow-hidden">
    <h2 class="px-5 pb-3 pt-4 text-base font-bold text-highlighted">{{ t('profile.feed.title') }}</h2>

    <p v-if="!events.length" class="border-t border-inset-line px-5 py-8 text-center text-sm text-muted">
      {{ t('profile.feed.empty') }}
    </p>

    <component
      :is="event.kind === 'play' ? 'div' : 'NuxtLink'"
      v-for="(event, index) in events"
      :key="`${event.kind}-${event.at}-${index}`"
      :to="event.kind === 'play' ? undefined : localePath(event.path)"
      class="flex flex-wrap items-start gap-3 border-t border-inset-line px-5 py-3 transition-colors"
      :class="event.kind !== 'play' && 'hover:bg-white/5'"
    >
      <span
        class="grid size-8 shrink-0 place-items-center rounded-lg border"
        :class="MARKS[event.kind].tint
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-inset-line bg-inset text-muted'"
      >
        <UIcon :name="MARKS[event.kind].icon" class="size-4" />
      </span>

      <span class="min-w-0 flex-1 basis-48">
        <span class="block text-pretty text-sm text-default">
          <b class="font-bold text-highlighted">{{ t(`profile.feed.${event.kind}`) }}</b>
          {{ subject(event) }}
          <template v-if="event.kind === 'release'"> {{ event.version }}</template>
        </span>
        <span class="mt-0.5 block text-xs text-dimmed">{{ detail(event) }}</span>
      </span>

      <span class="shrink-0 whitespace-nowrap text-xs text-dimmed">{{ timeAgo(event.at, locale) }}</span>
    </component>
  </UiPanel>
</template>
