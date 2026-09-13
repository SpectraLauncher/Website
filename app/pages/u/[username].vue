<script setup lang="ts">
import { headCommand, HEAD_VERSIONS, type HeadVersion } from '~/utils/mc/playerHead'
import { capeTextureUrl, modCapeUrl, type CapeSource } from '~/utils/mc/skin'

const route = useRoute()
const localePath = useLocalePath()
const { t, locale } = useI18n()
const toast = useToast()
const session = useAuthSession()
const { count } = useCatalogFormat()

type Status = 'online' | 'offline' | 'in_game' | 'dnd'

interface PublicUser {
  id: string
  name: string | null
  username: string | null
  image: string | null
}

interface Profile {
  user: PublicUser & {
    createdAt: string
    mcUsername: string | null
    mcUuid: string | null
    bio: string | null
    links: Record<string, string> | null
  }
  friends: Array<PublicUser & { friendshipId: number, status: Status }>
  visibility: 'public' | 'mutual'
  isOwner: boolean
  stats: {
    packs: number
    downloads: number
    firstDay: string | null
    seconds: number
    activeDays: number
    week: number
    lastSeen: number | null
  }
  activity: Array<{ day: string, launches: number, seconds: number }>
  feed: ProfileEvent[]
  badges: Array<{ slug: string, name: string, description: string, image: string | null }>
  projects: Array<{
    id: string
    path: string
    title: string
    summary: string
    icon: string | null
    downloads: number
  }>
}

const username = computed(() => String(route.params.username ?? ''))

const { data, error } = await useFetch<Profile>(() => `/api/u/${encodeURIComponent(username.value)}`)

// The panel below says "no such person" either way; this makes the answer say it
// too. robots already keeps it out of search, but a link checker, an uptime probe
// and anything reading the status saw 200 for every address anybody typed.
if (import.meta.server && !data.value) {
  setResponseStatus(useRequestEvent()!, 404)
}

const label = (u: PublicUser) => u.username || u.name || '—'
const mc = computed(() => data.value?.user.mcUsername ?? '')

const profileLinks = computed(() =>
  LINK_KINDS
    .filter(kind => data.value?.user.links?.[kind])
    .map(kind => ({ kind, url: data.value!.user.links![kind]! })))

const joined = computed(() => {
  const raw = data.value?.user.createdAt
  if (!raw) return ''
  const ms = Number.isNaN(Number(raw)) ? Date.parse(raw) : Number(raw)
  return Number.isFinite(ms)
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(ms))
    : ''
})

const STATUS_STYLE: Record<Status, string> = {
  online: 'bg-green-400',
  in_game: 'bg-sky-400',
  dnd: 'bg-red-400',
  offline: 'bg-zinc-500',
}

const signedIn = computed(() => Boolean(session.value.data))

const openList = computed(() => data.value?.visibility === 'public' || data.value?.isOwner)

const friendsHeading = computed(() => {
  if (!data.value) return ''
  return openList.value
    ? t('profile.friends', { n: data.value.friends.length })
    : t('profile.friendsMutual', { n: data.value.friends.length })
})

// The four figures that fit above the fold, in the order somebody scans them:
// what they made, how far it reached, who they know, how much they play.
const KEY_FIGURES = computed(() => {
  const stats = data.value?.stats
  if (!stats) return []

  return [
    { label: t('profile.statPacks'), value: count(stats.packs) },
    { label: t('profile.statDownloads'), value: count(stats.downloads) },
    { label: t('profile.statFriends'), value: openList.value ? count(data.value!.friends.length) : '—' },
    { label: t('activity.week'), value: stats.week ? humanDuration(stats.week) : '—' },
  ]
})

const LAUNCHER_STATS = computed(() => {
  const stats = data.value?.stats
  if (!stats) return []

  const firstJoin = stats.firstDay
    ? new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'short', timeZone: 'UTC' })
        .format(new Date(`${stats.firstDay}T00:00:00Z`))
    : '—'

  return [
    { k: t('activity.firstJoin'), v: firstJoin },
    { k: t('activity.lastOnline'), v: stats.lastSeen ? timeAgo(stats.lastSeen, locale.value) : '—' },
    { k: t('activity.perDay'), v: stats.activeDays ? humanDuration(stats.seconds / stats.activeDays) : '—' },
  ]
})

const TABS = ['overview', 'projects', 'friends'] as const
const tab = ref<(typeof TABS)[number]>('overview')

const skinCanvas = shallowRef<HTMLCanvasElement | null>(null)
const capeCanvas = shallowRef<HTMLCanvasElement | null>(null)
const skinModel = ref<'classic' | 'slim'>('classic')

const capes = ref<Array<{ key: string, url: string, thumb: string, name: string }>>([])

async function loadMinecraft() {
  if (!mc.value) return

  const profile = await $fetch<{ skin: string | null, cape: string | null, model: 'classic' | 'slim', uuid: string }>(
    '/api/mc-skin', { query: { q: mc.value.toLowerCase() } }).catch(() => null)

  if (!profile) return

  skinModel.value = profile.model
  if (profile.skin) skinCanvas.value = await loadSkinCanvas(profile.skin).catch(() => null)
  if (profile.cape) capeCanvas.value = await loadPlainCanvas(profile.cape).catch(() => null)

  const res = await $fetch<{
    capes: Array<{ source: CapeSource }>
    owned: Array<{ slug: string, name: string, hash: string }>
  }>('/api/mc-capes', { query: { name: mc.value, uuid: profile.uuid } }).catch(() => null)

  if (!res) return

  const found = [
    ...(res.owned ?? []).map(c => ({ key: `mj-${c.slug}`, url: capeTextureUrl(c.hash), name: c.name })),
    ...(res.capes ?? [])
      .filter(c => c.source !== 'minecraft')
      .map(c => ({ key: c.source, url: modCapeUrl(c.source, mc.value, profile.uuid), name: c.source })),
  ]

  capes.value = (await Promise.all(found.map(async cape => ({
    ...cape,
    thumb: await loadCapeFront(cape.url).catch(() => ''),
  })))).filter(c => c.thumb)
}

onMounted(loadMinecraft)

const headVersion = ref<HeadVersion>('modern')

const give = computed(() => (mc.value
  ? headCommand({
      version: headVersion.value,
      mode: 'name',
      name: mc.value,
      uuid: data.value?.user.mcUuid ?? '',
      textures: '',
      target: '@p',
      amount: 1,
    })
  : ''))

const locatorHex = computed(() => {
  const uuid = data.value?.user.mcUuid
  return uuid && isUuid(uuid) ? toHex(locatorColor(dashUuid(uuid))) : null
})

const origin = useRequestURL().origin
const profileUrl = computed(() => `${origin}/u/${data.value?.user.username ?? ''}`)
const renderUrl = computed(() => (mc.value ? `${origin}/render/default/${mc.value}/full?size=512` : ''))
const embedCode = computed(() => (mc.value ? `<img src="${renderUrl.value}" alt="${mc.value}" width="256">` : ''))

async function copy(value: string) {
  if (!value) return
  await navigator.clipboard.writeText(value)
  toast.add({ title: t('profile.copied'), icon: 'i-pixelarticons-check' })
}

const seoTitle = computed(() =>
  data.value ? `${label(data.value.user)}` : `${t('profile.notFound')}`)
const seoDescription = computed(() =>
  data.value ? t('profile.metaDescription', { name: label(data.value.user) }) : '')

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  ogType: 'profile',
  ogUrl: () => profileUrl.value,
  robots: () => (data.value ? 'index, follow' : 'noindex'),
})

// The head crop rather than the full render: at favicon size a whole standing
// figure is four legible pixels.
const headUrl = computed(() => (mc.value ? `${origin}/render/default/${mc.value}/head?size=64` : ''))

// A player's own face is a better mark for their page than our logo, and the
// browser keeps showing it while the tab is open.
useHead({
  link: () => (headUrl.value
    ? [{ rel: 'icon', type: 'image/png', href: headUrl.value, key: 'favicon' }]
    : []),
})

defineOgImage('Entity', {
  title: () => (data.value ? label(data.value.user) : t('profile.notFound')),
  description: () => seoDescription.value,
  kind: () => t('profile.player'),
  image: () => renderUrl.value || undefined,
  portrait: true,
  // What the profile page itself leads with, so the card and the page agree.
  facts: () => {
    if (!data.value) return []

    const stats = data.value.stats
    const out: Array<{ value: string, label: string }> = []

    if (stats.packs) out.push({ value: count(stats.packs), label: t('profile.statPacks') })
    if (stats.downloads) out.push({ value: count(stats.downloads), label: t('profile.statDownloads') })
    if (data.value.badges?.length) {
      out.push({ value: String(data.value.badges.length), label: t('profile.badges') })
    }
    if (!out.length && data.value.user.mcUsername) {
      out.push({ value: data.value.user.mcUsername, label: 'Minecraft' })
    }

    return out
  },
})

useSchemaOrg(computed(() => (data.value
  ? [
      defineWebPage({ '@type': 'ProfilePage' }),
      definePerson({
        name: label(data.value.user),
        alternateName: data.value.user.username,
        url: profileUrl.value,
        ...(renderUrl.value ? { image: renderUrl.value } : {}),
        ...(data.value.badges?.length
          ? { award: data.value.badges.map((badge: { name: string }) => badge.name) }
          : {}),
      }),
    ]
  : [])))
</script>

<template>
  <UiPageShell>
    <template v-if="error || !data">
      <UiPanel class="mx-auto max-w-lg p-10 text-center">
        <span class="inline-flex size-12 items-center justify-center rounded-2xl border border-raised-line bg-raised">
          <UIcon name="i-pixelarticons-avatar-circle-x" class="size-6 text-muted" />
        </span>
        <h1 class="mt-4 text-2xl font-bold tracking-tight text-highlighted">{{ t('profile.notFound') }}</h1>
        <p class="mt-2 font-mono text-sm text-dimmed">@{{ username }}</p>
        <UButton
          :to="localePath('/launcher')"
          class="mt-6"
          size="lg"
          color="neutral"
          variant="subtle"
          :label="t('nav.launcher')"
        />
      </UiPanel>
    </template>

    <template v-else>
      <UiPanel class="overflow-hidden">
        <div class="flex flex-wrap gap-6 p-5 sm:p-6">
          <ProfileSkin
            v-if="mc"
            class="shrink-0"
            :name="mc"
            :skin="skinCanvas"
            :cape="capeCanvas"
            :model="skinModel"
          />

          <div class="min-w-0 flex-1 basis-72">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 class="text-3xl font-extrabold tracking-tight text-highlighted">
                {{ data.user.name || label(data.user) }}
              </h1>
              <span class="font-mono text-sm text-dimmed">@{{ data.user.username }}</span>
            </div>

            <p v-if="data.user.bio" class="mt-2.5 max-w-prose whitespace-pre-wrap break-words text-pretty text-muted">
              {{ data.user.bio }}
            </p>

            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-dimmed">
              <span v-if="joined" class="inline-flex items-center gap-1.5">
                <UIcon name="i-pixelarticons-calendar" class="size-3.5" />
                {{ t('profile.joined', { date: joined }) }}
              </span>
              <span v-if="mc" class="inline-flex items-center gap-1.5">
                <UIcon name="i-pixelarticons-box" class="size-3.5" />
                <span class="font-mono">{{ mc }}</span>
              </span>
              <UTooltip
                v-if="locatorHex"
                :text="t('profile.locatorColor', { name: mc || label(data.user) })"
              >
                <NuxtLink
                  :to="localePath('/tools/locator')"
                  class="block size-3.5 shrink-0 rounded-full border border-white/20 transition-transform hover:scale-125"
                  :style="{ background: locatorHex, boxShadow: `0 0 10px ${locatorHex}80` }"
                  :aria-label="t('profile.locatorColor', { name: mc || label(data.user) })"
                />
              </UTooltip>
            </div>

            <div v-if="profileLinks.length" class="mt-3 flex flex-wrap gap-1.5">
              <UButton
                v-for="link in profileLinks"
                :key="link.kind"
                :to="link.url"
                :icon="LINK_ICONS[link.kind]"
                :label="t(`links.${link.kind}`)"
                size="xs"
                variant="soft"
                color="neutral"
                target="_blank"
                rel="nofollow ugc noopener noreferrer"
                external
              />
            </div>

            <div v-if="data.badges.length" class="mt-4 flex flex-wrap gap-2">
              <NuxtLink
                v-for="badge in data.badges"
                :key="badge.slug"
                :to="localePath(`/badges/${badge.slug}`)"
                class="inline-flex h-8 items-center gap-2 rounded-full border border-raised-line bg-raised px-3 text-xs font-semibold text-muted transition-colors hover:border-zinc-600 hover:text-highlighted"
                :title="badge.description || badge.name"
              >
                <img v-if="badge.image" :src="badge.image" :alt="''" class="size-4 object-contain">
                <UIcon v-else name="i-pixelarticons-trophy" class="size-3.5 text-primary" />
                {{ badge.name }}
              </NuxtLink>
            </div>
          </div>

          <div class="flex flex-1 basis-52 flex-col justify-end gap-3">
            <div class="grid grid-cols-2 gap-3">
              <UiStat
                v-for="figure in KEY_FIGURES"
                :key="figure.label"
                :label="figure.label"
                :value="figure.value"
              />
            </div>
          </div>
        </div>

        <nav class="flex gap-1 overflow-x-auto border-t border-raised-line px-3">
          <button
            v-for="id in TABS"
            :key="id"
            type="button"
            class="shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors"
            :class="tab === id
              ? 'border-primary font-bold text-highlighted'
              : 'border-transparent font-semibold text-muted hover:text-highlighted'"
            :aria-current="tab === id ? 'page' : undefined"
            @click="tab = id"
          >{{ t(`profile.tabs.${id}`) }}</button>
        </nav>
      </UiPanel>

      <div class="mt-5 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <main class="flex min-w-0 flex-col gap-5">
          <template v-if="tab === 'overview'">
            <UiPanel class="p-5">
              <h2 class="mb-4 text-base font-bold text-highlighted">{{ t('activity.title') }}</h2>
              <UiActivityGraph v-if="data.activity.length" :days="data.activity" />
              <p v-else class="text-sm/relaxed text-muted">{{ t('activity.empty') }}</p>
            </UiPanel>

            <ProfileFeed :events="data.feed" />
          </template>

          <template v-else-if="tab === 'projects'">
            <UiPanel
              v-for="project in data.projects"
              :key="project.id"
              :to="localePath(project.path)"
              class="flex items-center gap-4 p-4"
            >
              <CatalogThumb :src="project.icon" fallback="i-pixelarticons-package" class="size-14" />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-bold text-highlighted">{{ project.title }}</span>
                <span class="mt-0.5 block line-clamp-1 text-sm text-muted">{{ project.summary }}</span>
                <span class="mt-1 block text-xs text-dimmed">
                  {{ t('catalog.downloads', { n: count(project.downloads) }) }}
                </span>
              </span>
            </UiPanel>

            <UiPanel v-if="!data.projects.length" class="p-12 text-center">
              <UIcon name="i-pixelarticons-package" class="mx-auto size-10 text-dimmed" />
              <p class="mt-3 text-sm text-muted">{{ t('catalog.org.noProjects') }}</p>
            </UiPanel>
          </template>

          <template v-else>
            <UiPanel class="p-5">
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <h2 class="text-base font-bold text-highlighted">{{ friendsHeading }}</h2>
                <UIcon
                  v-if="!openList"
                  name="i-pixelarticons-eye-closed"
                  class="size-3.5 text-dimmed"
                  :title="t('profile.friendsPrivate')"
                />
              </div>

              <div v-if="data.friends.length" class="grid gap-2 sm:grid-cols-2">
                <NuxtLink
                  v-for="friend in data.friends"
                  :key="friend.friendshipId"
                  :to="localePath(`/u/${friend.username}`)"
                  class="flex items-center gap-3 rounded-xl border border-raised-line bg-raised px-4 py-3 transition-colors hover:border-zinc-600"
                >
                  <span class="relative shrink-0">
                    <img v-if="friend.image" :src="friend.image" alt="" class="size-9 rounded-full object-cover">
                    <span
                      v-else
                      class="flex size-9 items-center justify-center rounded-full text-sm font-bold"
                      :style="`background:hsl(${initialsAvatar(label(friend)).hue} 60% 30%)`"
                    >{{ initialsAvatar(label(friend)).letter }}</span>

                    <span
                      class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-panel"
                      :class="STATUS_STYLE[friend.status]"
                    ></span>
                  </span>

                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold text-highlighted">{{ label(friend) }}</span>
                    <span class="block truncate text-xs text-dimmed">{{ t(`profile.status.${friend.status}`) }}</span>
                  </span>
                </NuxtLink>
              </div>

              <p v-else-if="openList" class="text-sm text-muted">{{ t('profile.noFriends') }}</p>
              <p v-else-if="!signedIn" class="text-sm/relaxed text-muted">{{ t('profile.friendsSignIn') }}</p>
              <p v-else class="text-sm/relaxed text-muted">{{ t('profile.noMutual') }}</p>

              <p v-if="!openList" class="mt-3 text-xs/relaxed text-dimmed">{{ t('profile.friendsPrivate') }}</p>
            </UiPanel>
          </template>
        </main>

        <aside class="flex min-w-0 flex-col gap-4">
          <UiPanel v-if="mc" class="p-5">
            <h2 class="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">{{ t('activity.statsTitle') }}</h2>
            <div
              v-for="row in LAUNCHER_STATS"
              :key="row.k"
              class="flex justify-between gap-3 py-1.5 text-sm"
            >
              <span class="text-dimmed">{{ row.k }}</span>
              <span class="text-right font-semibold text-default">{{ row.v }}</span>
            </div>

            <p v-if="data.user.mcUuid" class="mt-3 break-all border-t border-raised-line pt-3 font-mono text-[11px] text-dimmed">
              {{ data.user.mcUuid }}
            </p>
          </UiPanel>

          <UiPanel v-if="capes.length" class="p-5">
            <h2 class="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">
              {{ t('profile.capes') }} ({{ capes.length }})
            </h2>
            <div class="grid grid-cols-4 gap-2">
              <div
                v-for="cape in capes"
                :key="cape.key"
                class="overflow-hidden rounded-lg border border-raised-line bg-raised"
                :title="cape.name"
              >
                <img :src="cape.thumb" :alt="cape.name" class="block w-full [image-rendering:pixelated]">
              </div>
            </div>
          </UiPanel>

          <UiPanel v-if="mc" class="p-5">
            <h2 class="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">{{ t('profile.commands') }}</h2>

            <p class="mb-1.5 text-xs text-dimmed">{{ t('profile.head') }}</p>
            <div class="mb-2 flex gap-1">
              <UButton
                v-for="v in HEAD_VERSIONS"
                :key="v"
                size="xs"
                color="neutral"
                :variant="headVersion === v ? 'subtle' : 'ghost'"
                :label="v === 'modern' ? '1.20.5+' : '1.13–1.20.4'"
                @click="headVersion = v"
              />
            </div>
            <button
              type="button"
              class="mb-4 flex w-full cursor-pointer items-center gap-2 rounded-xl border border-raised-line bg-raised px-3 py-2 text-left transition-colors hover:border-zinc-600"
              @click="copy(give)"
            >
              <code class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{{ give }}</code>
              <UIcon name="i-pixelarticons-copy" class="size-3.5 shrink-0 text-dimmed" />
            </button>

            <p class="mb-1.5 text-xs text-dimmed">{{ t('profile.renderApi') }}</p>
            <button
              type="button"
              class="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-raised-line bg-raised px-3 py-2 text-left transition-colors hover:border-zinc-600"
              @click="copy(renderUrl)"
            >
              <code class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{{ renderUrl }}</code>
              <UIcon name="i-pixelarticons-copy" class="size-3.5 shrink-0 text-dimmed" />
            </button>
            <NuxtLink
              :to="localePath('/tools/skin-poses')"
              class="mt-2 inline-flex items-center gap-1 text-xs text-dimmed transition-colors hover:text-default"
            >
              {{ t('profile.morePoses') }}
              <UIcon name="i-pixelarticons-arrow-right" class="size-3" />
            </NuxtLink>
          </UiPanel>

          <UiPanel class="p-5">
            <h2 class="mb-3 text-[11px] font-bold uppercase tracking-[0.09em] text-dimmed">{{ t('profile.share') }}</h2>

            <button
              type="button"
              class="mb-3 flex w-full cursor-pointer items-center gap-2 rounded-xl border border-raised-line bg-raised px-3 py-2 text-left transition-colors hover:border-zinc-600"
              @click="copy(profileUrl)"
            >
              <code class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{{ profileUrl }}</code>
              <UIcon name="i-pixelarticons-copy" class="size-3.5 shrink-0 text-dimmed" />
            </button>

            <UButton
              v-if="mc"
              block
              size="sm"
              variant="subtle"
              color="neutral"
              icon="i-pixelarticons-brackets-angle"
              :label="t('profile.embed')"
              @click="copy(embedCode)"
            />
          </UiPanel>
        </aside>
      </div>
    </template>

    <template #after>
      <DiscordCta />
    </template>
  </UiPageShell>
</template>
