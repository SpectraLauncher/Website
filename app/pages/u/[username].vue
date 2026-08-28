<script setup lang="ts">
import { headCommand, HEAD_VERSIONS, type HeadVersion } from '~/utils/playerHead'
import { capeTextureUrl, modCapeUrl, type CapeSource, type SkinAnimation } from '~/utils/skin'

const route = useRoute()
const localePath = useLocalePath()
const { t, locale } = useI18n()
const toast = useToast()
const session = useAuthSession()

type Status = 'online' | 'offline' | 'in_game' | 'dnd'

interface PublicUser {
  id: string
  name: string | null
  username: string | null
  image: string | null
}

interface Profile {
  user: PublicUser & { createdAt: string, mcUsername: string | null, mcUuid: string | null }
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
  badges: Array<{ slug: string, name: string, description: string, image: string | null }>
}

const username = computed(() => String(route.params.username ?? ''))

const { data, error } = await useFetch<Profile>(() => `/api/u/${encodeURIComponent(username.value)}`)

const label = (u: PublicUser) => u.username || u.name || '—'
const mc = computed(() => data.value?.user.mcUsername ?? '')

const joined = computed(() => {
  const raw = data.value?.user.createdAt
  if (!raw) return ''
  const ms = Number.isNaN(Number(raw)) ? Date.parse(raw) : Number(raw)
  return Number.isFinite(ms)
    ? new Date(ms).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''
})

const STATUS_STYLE: Record<Status, string> = {
  online: 'bg-green-400',
  in_game: 'bg-sky-400',
  dnd: 'bg-red-400',
  offline: 'bg-zinc-500'
}

const signedIn = computed(() => Boolean(session.value.data))
const LAUNCHER_STATS = computed(() => {
  const stats = data.value?.stats
  if (!stats) return []

  const firstJoin = stats.firstDay
    ? new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'short', timeZone: 'UTC' })
        .format(new Date(`${stats.firstDay}T00:00:00Z`))
    : '—'

  const average = stats.activeDays ? humanDuration(stats.seconds / stats.activeDays) : '—'

  return [
    { label: t('activity.firstJoin'), value: firstJoin },
    { label: t('activity.lastOnline'), value: stats.lastSeen ? timeAgo(stats.lastSeen, locale.value) : '—' },
    { label: t('activity.perDay'), value: average },
    { label: t('activity.week'), value: stats.week ? humanDuration(stats.week) : '—' }
  ]
})

const openList = computed(() => data.value?.visibility === 'public' || data.value?.isOwner)

const friendsHeading = computed(() => {
  if (!data.value) return ''
  return openList.value
    ? t('profile.friends', { n: data.value.friends.length })
    : t('profile.friendsMutual', { n: data.value.friends.length })
})

const skinCanvas = shallowRef<HTMLCanvasElement | null>(null)
const capeCanvas = shallowRef<HTMLCanvasElement | null>(null)
const skinModel = ref<'classic' | 'slim'>('classic')

const capes = ref<Array<{ key: string, url: string, thumb: string, name: string }>>([])

const MODEL_YAW = -20

const expanded = ref(false)

const base = ref<SkinAnimation>('none')
const held = ref(new Set<string>())

const animation = computed<SkinAnimation>(() =>
  held.value.has('crouch') ? 'crouch' : held.value.has('walk') ? 'walk' : base.value)

const WALK_KEYS = new Set(['w', 'arrowup', 's', 'arrowdown'])

const bind = (event: KeyboardEvent, down: boolean) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return

  const key = event.key.toLowerCase()
  const action = key === 'shift' ? 'crouch' : WALK_KEYS.has(key) ? 'walk' : ''
  if (!action) return

  const next = new Set(held.value)
  down ? next.add(action) : next.delete(action)
  held.value = next
}

const onDown = (e: KeyboardEvent) => bind(e, true)
const onUp = (e: KeyboardEvent) => bind(e, false)
const onBlur = () => { held.value = new Set() }

const ANIMATIONS: Array<{ id: SkinAnimation, icon: string, label: string }> = [
  { id: 'none', icon: 'i-lucide-user-round', label: 'profile.animIdle' },
  { id: 'walk', icon: 'i-lucide-footprints', label: 'profile.animWalk' },
  { id: 'crouch', icon: 'i-lucide-arrow-down-to-line', label: 'profile.animCrouch' }
]

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
      .map(c => ({ key: c.source, url: modCapeUrl(c.source, mc.value, profile.uuid), name: c.source }))
  ]

  capes.value = (await Promise.all(found.map(async cape => ({
    ...cape,
    thumb: await loadCapeFront(cape.url).catch(() => '')
  })))).filter(c => c.thumb)
}

onMounted(() => {
  loadMinecraft()
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  window.addEventListener('blur', onBlur)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onDown)
  window.removeEventListener('keyup', onUp)
  window.removeEventListener('blur', onBlur)
})

const headVersion = ref<HeadVersion>('modern')

const give = computed(() => (mc.value
  ? headCommand({
      version: headVersion.value,
      mode: 'name',
      name: mc.value,
      uuid: data.value?.user.mcUuid ?? '',
      textures: '',
      target: '@p',
      amount: 1
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
  toast.add({ title: t('profile.copied'), icon: 'i-lucide-check' })
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
  ogImage: () => renderUrl.value || undefined,
  twitterCard: () => (renderUrl.value ? 'summary_large_image' : 'summary'),
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDescription.value,
  robots: () => (data.value ? 'index, follow' : 'noindex')
})

defineOgImage('Spectra', {
  title: () => (data.value ? label(data.value.user) : t('profile.notFound')),
  description: () => seoDescription.value
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
          : {})
      })
    ]
  : [])))
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-40% mask-b-to-100%"></div>

      <template v-if="error || !data">
        <section class="container mx-auto max-w-lg px-4 pb-24 pt-40">
          <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-10 text-center backdrop-blur-sm">
            <span class="inline-flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <UIcon name="i-lucide-user-round-x" class="size-6 text-muted" />
            </span>
            <h1 class="mt-4 text-2xl font-semibold tracking-tight">{{ t('profile.notFound') }}</h1>
            <p class="mt-2 font-mono text-sm text-dimmed">@{{ username }}</p>
            <UButton
              :to="localePath('/launcher')"
              class="mt-6 rounded-xl"
              size="lg"
              color="neutral"
              variant="outline"
              :label="t('nav.launcher')"
            />
          </div>
        </section>
      </template>

      <template v-else>
        <section class="container mx-auto px-4 pt-36">
          <div class="flex flex-wrap items-end gap-8">
            <div
              v-if="mc"
              class="relative shrink-0 transition-[height,width] duration-300"
              :class="expanded ? 'h-[36rem] w-80' : '-mb-36 h-[30rem] w-64'"
            >
              <SkinViewer
                v-if="skinCanvas"
                :skin="skinCanvas"
                :cape="capeCanvas"
                :model="skinModel"
                :animation="animation"
                :yaw="-MODEL_YAW"
                :spin="false"
                class="!h-full !bg-transparent"
              />
              <img
                v-else
                :src="`/render/default/${encodeURIComponent(mc)}/full?size=512&light=studio&yaw=${MODEL_YAW}`"
                :alt="mc"
                class="size-full object-contain [image-rendering:pixelated]"
              >

              <div
                v-if="expanded"
                class="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1 rounded-2xl border border-white/10 bg-black/60 p-1 backdrop-blur-sm"
              >
                <UTooltip v-for="anim in ANIMATIONS" :key="anim.id" :text="t(anim.label)">
                  <UButton
                    size="sm"
                    color="neutral"
                    :variant="base === anim.id ? 'subtle' : 'ghost'"
                    :icon="anim.icon"
                    :aria-label="t(anim.label)"
                    @click="base = anim.id"
                  />
                </UTooltip>
              </div>
            </div>

            <div class="min-w-0 flex-1 pb-6">
              <h1 class="mb-2 truncate text-5xl font-semibold tracking-tight">{{ data.user.name || label(data.user) }}</h1>
              <p class="mb-4 font-mono text-muted">@{{ data.user.username }}</p>

              <div class="mb-1 flex items-center gap-1">
                <UButton
                  v-if="data.user.mcUuid"
                  size="sm"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-copy"
                  class="font-mono"
                  :label="'UUID '+data.user.mcUuid"
                  @click="copy(data.user.mcUuid)"
                />
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
              <div class="flex flex-wrap items-center gap-2">
                <UBadge v-if="joined" size="lg" variant="subtle" color="neutral" icon="i-lucide-calendar" :label="t('profile.joined', { date: joined })" />
                <UBadge v-if="mc" size="lg" variant="subtle" color="neutral" icon="i-lucide-box" :label="mc" />
                <UButton
                  v-if="mc"
                  size="sm"
                  variant="subtle"
                  color="neutral"
                  class="rounded-xl"
                  :icon="expanded ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
                  :label="t(expanded ? 'profile.shrink' : 'profile.expand')"
                  @click="expanded = !expanded"
                />
              </div>

              <p v-if="mc" class="mt-3 text-xs text-dimmed">{{ t('profile.keysHint') }}</p>
            </div>
          </div>
        </section>

        <section class="relative z-10 container mx-auto grid gap-4 px-4 pb-24 pt-10 lg:grid-cols-[320px_1fr] lg:items-start">
          <div class="flex flex-col gap-4">
            <div v-if="data.badges.length" class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
              <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold">
                <UIcon name="i-lucide-award" class="size-4 text-primary" />
                {{ t('badges.title') }}
                <span class="text-dimmed">({{ data.badges.length }})</span>
              </h2>

              <div class="flex flex-wrap gap-2">
                <NuxtLink
                  v-for="badge in data.badges"
                  :key="badge.slug"
                  :to="localePath(`/badges/${badge.slug}`)"
                  class="grid size-12 place-items-center rounded-xl border border-white/10 bg-black/40 transition-colors hover:border-zinc-400"
                  :title="`${badge.name}${badge.description ? ' — ' + badge.description : ''}`"
                >
                  <img v-if="badge.image" :src="badge.image" :alt="badge.name" class="size-9 object-contain">
                  <UIcon v-else name="i-lucide-award" class="size-5 text-primary" />
                </NuxtLink>
              </div>
            </div>

            <div v-if="capes.length" class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
              <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold">
                <UIcon name="i-lucide-flag" class="size-4 text-primary" />
                {{ t('profile.capes') }}
                <span class="text-dimmed">({{ capes.length }})</span>
              </h2>
              <div class="grid grid-cols-4 gap-2">
                <div
                  v-for="cape in capes"
                  :key="cape.key"
                  class="overflow-hidden rounded-lg border border-white/10 bg-black/40"
                  :title="cape.name"
                >
                  <img
                    :src="cape.thumb"
                    :alt="cape.name"
                    class="block w-full [image-rendering:pixelated]"
                  >
                </div>
              </div>
            </div>

            <div v-if="mc" class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
              <h2 class="mb-4 flex items-center gap-2 text-sm font-semibold">
                <UIcon name="i-lucide-terminal" class="size-4 text-primary" />
                {{ t('profile.commands') }}
              </h2>

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
                class="mb-4 flex w-full cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-left transition-colors hover:border-zinc-500"
                @click="copy(give)"
              >
                <code class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{{ give }}</code>
                <UIcon name="i-lucide-copy" class="size-3.5 shrink-0 text-dimmed" />
              </button>

              <p class="mb-1.5 text-xs text-dimmed">{{ t('profile.renderApi') }}</p>
              <button
                type="button"
                class="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-left transition-colors hover:border-zinc-500"
                @click="copy(renderUrl)"
              >
                <code class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{{ renderUrl }}</code>
                <UIcon name="i-lucide-copy" class="size-3.5 shrink-0 text-dimmed" />
              </button>
              <NuxtLink :to="localePath('/tools/skin-poses')" class="mt-2 inline-flex items-center gap-1 text-xs text-dimmed transition-colors hover:text-default">
                {{ t('profile.morePoses') }}
                <UIcon name="i-lucide-arrow-right" class="size-3" />
              </NuxtLink>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-5 backdrop-blur-sm">
              <h2 class="mb-4 flex items-center gap-2 text-sm font-semibold">
                <UIcon name="i-lucide-share-2" class="size-4 text-primary" />
                {{ t('profile.share') }}
              </h2>

              <button
                type="button"
                class="mb-3 flex w-full cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-left transition-colors hover:border-zinc-500"
                @click="copy(profileUrl)"
              >
                <code class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{{ profileUrl }}</code>
                <UIcon name="i-lucide-copy" class="size-3.5 shrink-0 text-dimmed" />
              </button>

              <UButton
                v-if="mc"
                block
                size="sm"
                variant="outline"
                color="neutral"
                icon="i-lucide-code-xml"
                :label="t('profile.embed')"
                @click="copy(embedCode)"
              />
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <h2 class="mb-4 flex items-center gap-2 text-sm font-semibold">
                <UIcon name="i-lucide-chart-no-axes-column" class="size-4 text-primary" />
                {{ t('profile.stats') }}
              </h2>

              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div
                  v-for="figure in [
                    { label: t('profile.statPacks'), value: data.stats.packs },
                    { label: t('profile.statDownloads'), value: data.stats.downloads },
                    { label: t('profile.statFriends'), value: openList ? data.friends.length : null }
                  ]"
                  :key="figure.label"
                  class="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <p class="font-mono text-3xl font-semibold">{{ figure.value ?? '—' }}</p>
                  <p class="mt-1 text-xs text-muted">{{ figure.label }}</p>
                </div>
              </div>

              <p class="mt-4 text-sm/relaxed text-muted">{{ t('profile.shared') }}</p>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <div class="mb-4 flex flex-wrap items-center gap-3">
                <h2 class="flex items-center gap-2 text-sm font-semibold">
                  <UIcon name="i-lucide-users" class="size-4 text-primary" />
                  {{ friendsHeading }}
                </h2>
                <UIcon v-if="!openList" name="i-lucide-eye-off" class="size-3.5 text-dimmed" :title="t('profile.friendsPrivate')" />
              </div>

              <div v-if="data.friends.length" class="grid gap-2 sm:grid-cols-2">
                <NuxtLink
                  v-for="friend in data.friends"
                  :key="friend.friendshipId"
                  :to="localePath(`/u/${friend.username}`)"
                  class="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition-colors hover:border-zinc-500"
                >
                  <span class="relative shrink-0">
                    <img v-if="friend.image" :src="friend.image" alt="" class="size-9 rounded-full object-cover">
                    <span
                      v-else
                      class="flex size-9 items-center justify-center rounded-full text-sm font-bold"
                      :style="`background:hsl(${initialsAvatar(label(friend)).hue} 60% 30%)`"
                    >{{ initialsAvatar(label(friend)).letter }}</span>

                    <span
                      class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[#0b0f16]"
                      :class="STATUS_STYLE[friend.status]"
                    ></span>
                  </span>

                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">{{ label(friend) }}</p>
                    <p class="truncate text-xs text-dimmed">{{ t(`profile.status.${friend.status}`) }}</p>
                  </div>
                </NuxtLink>
              </div>

              <p v-else-if="openList" class="text-sm text-muted">{{ t('profile.noFriends') }}</p>
              <p v-else-if="!signedIn" class="text-sm/relaxed text-muted">{{ t('profile.friendsSignIn') }}</p>
              <p v-else class="text-sm/relaxed text-muted">{{ t('profile.noMutual') }}</p>

              <p v-if="!openList" class="mt-3 text-xs/relaxed text-dimmed">{{ t('profile.friendsPrivate') }}</p>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <h2 class="mb-5 flex items-center gap-2 text-sm font-semibold">
                <UIcon name="i-lucide-gauge" class="size-4 text-primary" />
                {{ t('activity.statsTitle') }}
              </h2>

              <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div
                  v-for="figure in LAUNCHER_STATS"
                  :key="figure.label"
                  class="rounded-2xl border border-white/10 bg-black/20 p-4 text-center"
                >
                  <p class="truncate text-2xl font-semibold">{{ figure.value }}</p>
                  <p class="mt-1 text-xs text-muted">{{ figure.label }}</p>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
              <h2 class="mb-5 flex items-center gap-2 text-sm font-semibold">
                <UIcon name="i-lucide-calendar-days" class="size-4 text-primary" />
                {{ t('activity.title') }}
              </h2>

              <ActivityGraph v-if="data.activity.length" :days="data.activity" />
              <p v-else class="text-sm/relaxed text-muted">{{ t('activity.empty') }}</p>
            </div>
          </div>
        </section>
      </template>
    </div>

    <DiscordCta />
  </div>
</template>
