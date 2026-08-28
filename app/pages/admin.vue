<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const localePath = useLocalePath()
const auth = useAuthClient()
const session = useAuthSession()

interface Bucket { label: string, value: number }

interface Stats {
  generatedAt: number
  overview: { totalInstalls: number, dau: number, wau: number, mau: number, launches30: number, crashes30: number }
  activeSeries: Bucket[]
  versions: Bucket[]
  os: Bucket[]
  locales: Bucket[]
  loaders: Bucket[]
  mcVersions: Bucket[]
  features: Bucket[]
  shares: {
    overview: { created30: number, active: number, downloads30: number, storedBytes: number }
    series: Bucket[]
    recent: Array<Record<string, any>>
    loaders: Bucket[]
  } | null
}

interface AdminUser {
  id: string
  name: string | null
  username: string | null
  email: string
  image: string | null
  emailVerified: boolean
  banned: boolean
  mcUsername: string | null
  createdAt: number
  lastSeen: number | null
  friends: number
  shares: number
}

const me = computed(() => session.value.data?.user as any)

const TABS = [
  { id: 'overview', icon: 'i-lucide-layout-dashboard', label: 'Przegląd' },
  { id: 'telemetry', icon: 'i-lucide-chart-no-axes-column', label: 'Telemetria' },
  { id: 'shares', icon: 'i-lucide-package', label: 'Paczki' },
  { id: 'users', icon: 'i-lucide-users', label: 'Użytkownicy' },
  { id: 'badges', icon: 'i-lucide-award', label: 'Odznaki' },
  { id: 'discord', icon: 'i-simple-icons-discord', label: 'Discord' }
] as const

const tab = ref<(typeof TABS)[number]['id']>('overview')

const busy = ref('')
const error = ref('')
const notice = ref('')
const denied = ref(false)

watch(denied, (lost) => {
  if (lost) navigateTo({ path: localePath('/login'), query: { next: localePath('/admin') } })
})

async function run(key: string, fn: () => Promise<any>) {
  busy.value = key
  error.value = ''
  notice.value = ''
  try {
    return await fn()
  }
  catch (e: any) {
    const status = e?.statusCode ?? e?.response?.status
    if (status === 401 || status === 403) {
      denied.value = true
      return
    }
    if (denied.value) return

    error.value = e?.data?.statusMessage || e?.message || 'Coś poszło nie tak.'
  }
  finally {
    busy.value = ''
  }
}

const stats = ref<Stats | null>(null)

const loadStats = () => run('stats', async () => {
  try {
    stats.value = await $fetch<Stats>('/api/admin/stats')
    denied.value = false
  }
  catch (e: any) {
    if ([401, 403, 404].includes(e?.statusCode ?? e?.response?.status)) {
      denied.value = true
      return
    }
    throw e
  }
})

const users = ref<AdminUser[]>([])
const usersTotal = ref(0)
const search = ref('')

const loadUsers = () => run('users', async () => {
  const res = await $fetch<{ total: number, users: AdminUser[] }>('/api/admin/users', {
    query: { q: search.value.trim() }
  })
  users.value = res.users
  usersTotal.value = res.total
})

let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadUsers, 350)
})

onBeforeUnmount(() => clearTimeout(searchTimer))

const editing = ref<string | null>(null)
const draft = reactive({ name: '', username: '' })

function startEdit(user: AdminUser) {
  editing.value = user.id
  draft.name = user.name ?? ''
  draft.username = user.username ?? ''
}

const saveUser = (user: AdminUser) => run(`user:${user.id}`, async () => {
  await $fetch(`/api/admin/users/${user.id}`, {
    method: 'PATCH',
    body: { name: draft.name, username: draft.username }
  })
  editing.value = null
  notice.value = 'Zapisano.'
  await loadUsers()
})

const toggleBan = (user: AdminUser) => run(`user:${user.id}`, async () => {
  await $fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: { banned: !user.banned } })
  notice.value = user.banned ? 'Konto odblokowane.' : 'Konto zablokowane, sesje usunięte.'
  await loadUsers()
})

const confirmDelete = ref<string | null>(null)

const deleteUser = (user: AdminUser) => run(`user:${user.id}`, async () => {
  await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
  confirmDelete.value = null
  notice.value = 'Konto usunięte.'
  await loadUsers()
})

interface AdminBadge {
  slug: string
  name: string
  description: string
  image: string | null
  rule: string
  rule_value: string | null
  holders: number
}

interface BadgeRuleDef {
  id: string
  label: string
  hint: string
  param: 'none' | 'number' | 'date' | 'text'
}

const badges = ref<AdminBadge[]>([])
const rules = ref<BadgeRuleDef[]>([])

const badgeForm = reactive({
  slug: '', name: '', description: '', image: '', rule: 'manual', ruleValue: ''
})

const badgeEditing = ref(false)

const ruleDef = computed(() => rules.value.find(r => r.id === badgeForm.rule))

const loadBadges = () => run('badges', async () => {
  const res = await $fetch<{ badges: AdminBadge[], rules: BadgeRuleDef[] }>('/api/admin/badges')
  badges.value = res.badges
  rules.value = res.rules
})

const recalcBadges = () => run('badge-sync', async () => {
  const res = await $fetch<{ awarded: number }>('/api/admin/badges/sync', { method: 'POST' })
  notice.value = res.awarded ? `Przyznano ${res.awarded} odznak.` : 'Nic nowego do przyznania.'
  await loadBadges()
})

function resetBadgeForm() {
  Object.assign(badgeForm, { slug: '', name: '', description: '', image: '', rule: 'manual', ruleValue: '' })
  badgeEditing.value = false
}

function editBadge(badge: AdminBadge) {
  Object.assign(badgeForm, {
    slug: badge.slug,
    name: badge.name,
    description: badge.description,
    image: badge.image ?? '',
    rule: badge.rule,
    ruleValue: badge.rule_value ?? ''
  })
  badgeEditing.value = true
}

const saveBadge = () => run('badge-save', async () => {
  const res = await $fetch<{ awarded: number }>('/api/admin/badges', {
    method: 'POST',
    body: { ...badgeForm, image: badgeForm.image || null, ruleValue: badgeForm.ruleValue || null }
  })

  notice.value = res.awarded
    ? `Zapisano. Przyznano ${res.awarded} kontom.`
    : 'Zapisano.'

  resetBadgeForm()
  await loadBadges()
})

const deleteBadge = (slug: string) => run(`badge:${slug}`, async () => {
  await $fetch(`/api/admin/badges/${slug}`, { method: 'DELETE' })
  notice.value = 'Odznaka usunięta.'
  await loadBadges()
})

const badgeImageInput = ref<HTMLInputElement>()

const pickBadgeImage = () => badgeImageInput.value?.click()

async function uploadBadgeImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  if (!IMAGE_TYPES.includes(file.type)) {
    error.value = 'Tylko PNG, JPEG albo WebP.'
    return
  }

  await run('badge-image', async () => {
    const blob = await toSquareWebp(file, 128, 'contain')

    const { url } = await $fetch<{ url: string }>('/api/admin/badges/image', {
      method: 'POST',
      query: { slug: badgeForm.slug },
      body: blob,
      headers: { 'content-type': 'image/webp' }
    })

    badgeForm.image = url
    notice.value = 'Obrazek wgrany.'
  })
}

const manual = reactive({ slug: '', username: '' })

const awardBadge = (revokeIt: boolean) => run('badge-award', async () => {
  await $fetch('/api/admin/badges/award', {
    method: 'POST',
    body: { slug: manual.slug, username: manual.username, revoke: revokeIt }
  })
  notice.value = revokeIt ? 'Odznaka odebrana.' : 'Odznaka przyznana.'
  manual.username = ''
  await loadBadges()
})

const purgeTest = () => run('purge', async () => {
  const res = await $fetch<{ deleted: number, failed: string[] }>('/api/admin/test-accounts', { method: 'DELETE' })
  notice.value = `Usunięto ${res.deleted} kont testowych.`
  await loadUsers()
})

onMounted(async () => {
  await loadStats()
  if (!denied.value) await loadUsers()
})

watch(tab, (to) => {
  if (to === 'users' && !users.value.length) loadUsers()
  if (to === 'badges' && !badges.value.length) loadBadges()
})

const signOut = async () => {
  await auth.signOut()
  await navigateTo(localePath('/'))
}

const nf = new Intl.NumberFormat('pl-PL')
const num = (n: number | null | undefined) => nf.format(n ?? 0)

function bytes(n: number) {
  if (!n) return '0 B'
  const units = ['B', 'kB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

const date = (ms: number | null) =>
  ms ? new Date(ms).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const KEY_FIGURES = computed(() => {
  const o = stats.value?.overview
  const s = stats.value?.shares?.overview
  return [
    { label: 'Instalacje', value: num(o?.totalInstalls), icon: 'i-lucide-download', hint: 'wszystkie' },
    { label: 'Aktywni dziś', value: num(o?.dau), icon: 'i-lucide-activity', hint: 'DAU' },
    { label: 'Aktywni w tygodniu', value: num(o?.wau), icon: 'i-lucide-calendar-days', hint: 'WAU' },
    { label: 'Aktywni w miesiącu', value: num(o?.mau), icon: 'i-lucide-calendar-range', hint: 'MAU' },
    { label: 'Uruchomienia', value: num(o?.launches30), icon: 'i-lucide-play', hint: '30 dni' },
    { label: 'Crashe', value: num(o?.crashes30), icon: 'i-lucide-triangle-alert', hint: '30 dni' },
    { label: 'Konta', value: num(usersTotal.value), icon: 'i-lucide-users', hint: 'łącznie' },
    { label: 'Paczki aktywne', value: num(s?.active), icon: 'i-lucide-package', hint: 'nie wygasły' }
  ]
})

const peak = (series: Bucket[] | undefined) =>
  Math.max(1, ...(series ?? []).map(b => b.value))

useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
useSeoMeta({ title: () => 'Panel', robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-6xl px-4 pb-24 pt-40">
        <div class="mb-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="flex flex-wrap items-center gap-5">
            <span class="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
              <UIcon name="i-lucide-shield" class="size-6 text-primary" />
            </span>

            <div class="min-w-0 flex-1">
              <h1 class="text-2xl font-semibold tracking-tight">Panel</h1>
              <p class="truncate text-sm text-muted">
                {{ me?.email || '—' }}
                <span v-if="stats" class="text-dimmed">
                  · dane z {{ new Date(stats.generatedAt).toLocaleString('pl-PL') }}
                </span>
              </p>
            </div>

            <UButton
              variant="outline"
              color="neutral"
              size="lg"
              class="rounded-xl"
              icon="i-lucide-refresh-cw"
              :loading="busy === 'stats' || busy === 'users'"
              label="Odśwież"
              @click="tab === 'users' ? loadUsers() : loadStats()"
            />
            <UButton
              variant="ghost"
              color="neutral"
              size="lg"
              class="rounded-xl"
              icon="i-lucide-log-out"
              label="Wyloguj"
              @click="signOut"
            />
          </div>
        </div>

        <UAlert v-if="error" color="error" variant="subtle" class="mb-4" icon="i-lucide-circle-alert" :description="error" />
        <UAlert v-if="notice" color="success" variant="subtle" class="mb-4" icon="i-lucide-check" :description="notice" />

        <div class="overflow-hidden rounded-3xl border border-zinc-600/50 bg-black/30 backdrop-blur-sm lg:grid lg:grid-cols-[230px_1fr]">
          <nav class="flex gap-1 overflow-x-auto border-b border-white/10 p-3 lg:flex-col lg:border-b-0 lg:border-r">
            <button
              v-for="item in TABS"
              :key="item.id"
              type="button"
              class="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors"
              :class="tab === item.id ? 'bg-white/10 text-default' : 'text-muted hover:bg-white/5 hover:text-default'"
              @click="tab = item.id"
            >
              <UIcon :name="item.icon" class="size-4 shrink-0" />
              <span class="whitespace-nowrap">{{ item.label }}</span>
            </button>
          </nav>

          <div class="p-6 lg:p-8">
            <template v-if="tab === 'overview'">
              <h2 class="mb-6 text-lg font-semibold tracking-tight">Przegląd</h2>

              <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div
                  v-for="figure in KEY_FIGURES"
                  :key="figure.label"
                  class="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div class="mb-2 flex items-center gap-2 text-dimmed">
                    <UIcon :name="figure.icon" class="size-4" />
                    <span class="text-xs uppercase tracking-[0.1em]">{{ figure.hint }}</span>
                  </div>
                  <p class="font-mono text-2xl font-semibold">{{ figure.value }}</p>
                  <p class="text-xs text-muted">{{ figure.label }}</p>
                </div>
              </div>

              <template v-if="stats?.activeSeries?.length">
                <h3 class="mb-3 mt-8 text-sm font-semibold">Aktywne instalacje — 30 dni</h3>
                <div class="flex h-32 items-end gap-1 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div
                    v-for="point in stats.activeSeries"
                    :key="point.label"
                    class="flex-1 rounded-t bg-primary/70 transition-colors hover:bg-primary"
                    :style="{ height: `${Math.max(2, (point.value / peak(stats.activeSeries)) * 100)}%` }"
                    :title="`${point.label}: ${point.value}`"
                  ></div>
                </div>
              </template>
            </template>

            <template v-else-if="tab === 'telemetry'">
              <h2 class="mb-6 text-lg font-semibold tracking-tight">Telemetria</h2>

              <div v-if="!stats" class="text-sm text-muted">Brak danych.</div>

              <div v-else class="grid gap-4 md:grid-cols-2">
                <div
                  v-for="group in [
                    { title: 'Wersje launchera', rows: stats.versions },
                    { title: 'Systemy', rows: stats.os },
                    { title: 'Języki', rows: stats.locales },
                    { title: 'Loadery', rows: stats.loaders },
                    { title: 'Wersje Minecrafta', rows: stats.mcVersions },
                    { title: 'Używane funkcje', rows: stats.features }
                  ]"
                  :key="group.title"
                  class="rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <h3 class="mb-3 text-sm font-semibold">{{ group.title }}</h3>

                  <div v-if="group.rows?.length" class="space-y-2">
                    <div v-for="row in group.rows" :key="row.label" class="text-xs">
                      <div class="mb-1 flex justify-between gap-3">
                        <span class="truncate text-muted">{{ row.label }}</span>
                        <span class="shrink-0 font-mono">{{ num(row.value) }}</span>
                      </div>
                      <div class="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div class="h-full rounded-full bg-primary/70" :style="{ width: `${(row.value / peak(group.rows)) * 100}%` }"></div>
                      </div>
                    </div>
                  </div>
                  <p v-else class="text-xs text-dimmed">—</p>
                </div>
              </div>
            </template>

            <template v-else-if="tab === 'shares'">
              <h2 class="mb-6 text-lg font-semibold tracking-tight">Paczki</h2>

              <div v-if="!stats?.shares" class="text-sm text-muted">Brak danych o udostępnieniach.</div>

              <template v-else>
                <div class="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div
                    v-for="figure in [
                      { label: 'Utworzone (30 dni)', value: num(stats.shares.overview.created30) },
                      { label: 'Aktywne', value: num(stats.shares.overview.active) },
                      { label: 'Pobrania (30 dni)', value: num(stats.shares.overview.downloads30) },
                      { label: 'W magazynie', value: bytes(stats.shares.overview.storedBytes) }
                    ]"
                    :key="figure.label"
                    class="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <p class="font-mono text-2xl font-semibold">{{ figure.value }}</p>
                    <p class="text-xs text-muted">{{ figure.label }}</p>
                  </div>
                </div>

                <h3 class="mb-3 text-sm font-semibold">Ostatnie</h3>
                <div class="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                  <table class="w-full min-w-[620px] text-left text-xs">
                    <thead class="text-dimmed">
                      <tr class="border-b border-white/10">
                        <th class="px-4 py-3 font-medium">Nazwa</th>
                        <th class="px-4 py-3 font-medium">Wersja</th>
                        <th class="px-4 py-3 font-medium">Loader</th>
                        <th class="px-4 py-3 text-right font-medium">Mody</th>
                        <th class="px-4 py-3 text-right font-medium">Rozmiar</th>
                        <th class="px-4 py-3 text-right font-medium">Pobrania</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in stats.shares.recent" :key="row.code" class="border-b border-white/5 last:border-0">
                        <td class="max-w-[220px] truncate px-4 py-2.5">{{ row.name || row.code }}</td>
                        <td class="px-4 py-2.5 font-mono text-muted">{{ row.mc_version || '—' }}</td>
                        <td class="px-4 py-2.5 text-muted">{{ row.loader || '—' }}</td>
                        <td class="px-4 py-2.5 text-right font-mono">{{ num(row.mods) }}</td>
                        <td class="px-4 py-2.5 text-right font-mono text-muted">{{ bytes(Number(row.size)) }}</td>
                        <td class="px-4 py-2.5 text-right font-mono">{{ num(row.downloads) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </template>

                        <template v-else-if="tab === 'badges'">
              <div class="mb-6 flex items-center justify-between gap-3">
                <h2 class="text-lg font-semibold tracking-tight">Odznaki</h2>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-refresh-cw"
                  label="Przelicz"
                  :loading="busy === 'badge-sync'"
                  @click="recalcBadges"
                />
              </div>

              <div class="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
                <div class="space-y-2">
                  <div
                    v-for="badge in badges"
                    :key="badge.slug"
                    class="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <img v-if="badge.image" :src="badge.image" :alt="badge.name" class="size-10 shrink-0 rounded-xl object-contain">
                    <span v-else class="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5">
                      <UIcon name="i-lucide-award" class="size-5 text-primary" />
                    </span>

                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium">{{ badge.name }}</p>
                      <p class="truncate font-mono text-xs text-dimmed">{{ badge.slug }}</p>
                    </div>

                    <div class="shrink-0 text-right">
                      <p class="font-mono text-sm">{{ num(badge.holders) }}</p>
                      <p class="text-[11px] text-dimmed">{{ rules.find(r => r.id === badge.rule)?.label ?? badge.rule }}</p>
                    </div>

                    <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" aria-label="Edytuj" @click="editBadge(badge)" />
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="error"
                      icon="i-lucide-trash-2"
                      aria-label="Usuń"
                      :loading="busy === `badge:${badge.slug}`"
                      @click="deleteBadge(badge.slug)"
                    />
                  </div>

                  <p v-if="!badges.length" class="text-sm text-muted">Brak odznak. Dodaj pierwszą obok.</p>
                </div>

                <div class="space-y-6">
                  <div class="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <h3 class="mb-4 text-sm font-semibold">{{ badgeEditing ? 'Edytuj odznakę' : 'Nowa odznaka' }}</h3>

                    <div class="space-y-2">
                      <UInput v-model="badgeForm.slug" size="sm" class="w-full font-mono" placeholder="slug, np. og" :disabled="badgeEditing" />
                      <UInput v-model="badgeForm.name" size="sm" class="w-full" placeholder="nazwa" />
                      <UTextarea v-model="badgeForm.description" :rows="2" size="sm" class="w-full" placeholder="opis" />
                      <div class="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2">
                        <img
                          v-if="badgeForm.image"
                          :src="badgeForm.image"
                          alt=""
                          class="size-12 shrink-0 rounded-lg object-contain"
                        >
                        <span v-else class="grid size-12 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">
                          <UIcon name="i-lucide-image" class="size-5 text-dimmed" />
                        </span>

                        <div class="min-w-0 flex-1">
                          <UButton
                            size="xs"
                            variant="subtle"
                            color="neutral"
                            icon="i-lucide-upload"
                            :loading="busy === 'badge-image'"
                            :disabled="!badgeForm.slug"
                            :label="badgeForm.image ? 'Zmień obrazek' : 'Wgraj obrazek'"
                            @click="pickBadgeImage"
                          />
                          <p class="mt-1 text-[11px] text-dimmed">
                            {{ badgeForm.slug ? 'PNG, JPEG albo WebP. Skalowany do 128 px.' : 'Najpierw podaj slug.' }}
                          </p>
                        </div>

                        <UButton
                          v-if="badgeForm.image"
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          icon="i-lucide-x"
                          aria-label="Usuń obrazek"
                          @click="badgeForm.image = ''"
                        />
                      </div>

                      <input
                        ref="badgeImageInput"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        class="hidden"
                        @change="uploadBadgeImage"
                      >

                      <USelect
                        v-model="badgeForm.rule"
                        size="sm"
                        class="w-full"
                        :items="rules.map(r => ({ label: r.label, value: r.id }))"
                      />
                      <UInput
                        v-if="ruleDef && ruleDef.param !== 'none'"
                        v-model="badgeForm.ruleValue"
                        size="sm"
                        class="w-full font-mono"
                        :type="ruleDef.param === 'date' ? 'date' : ruleDef.param === 'number' ? 'number' : 'text'"
                        placeholder="wartość warunku"
                      />
                      <p v-if="ruleDef" class="text-[11px] text-dimmed">{{ ruleDef.hint }}</p>

                      <div class="flex gap-2 pt-1">
                        <UButton
                          size="sm"
                          color="neutral"
                          :loading="busy === 'badge-save'"
                          :disabled="!badgeForm.slug || !badgeForm.name"
                          label="Zapisz"
                          @click="saveBadge"
                        />
                        <UButton v-if="badgeEditing" size="sm" variant="ghost" color="neutral" label="Anuluj" @click="resetBadgeForm" />
                      </div>
                    </div>
                  </div>

                  <div class="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <h3 class="mb-4 text-sm font-semibold">Przyznaj ręcznie</h3>

                    <div class="space-y-2">
                      <USelect
                        v-model="manual.slug"
                        size="sm"
                        class="w-full"
                        placeholder="wybierz odznakę"
                        :items="badges.map(b => ({ label: b.name, value: b.slug }))"
                      />
                      <UInput v-model="manual.username" size="sm" class="w-full" placeholder="nazwa użytkownika" />

                      <div class="flex gap-2 pt-1">
                        <UButton
                          size="sm"
                          color="neutral"
                          :loading="busy === 'badge-award'"
                          :disabled="!manual.slug || !manual.username"
                          label="Przyznaj"
                          @click="awardBadge(false)"
                        />
                        <UButton
                          size="sm"
                          variant="ghost"
                          color="error"
                          :disabled="!manual.slug || !manual.username"
                          label="Odbierz"
                          @click="awardBadge(true)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="tab === 'discord'">
              <h2 class="mb-6 text-lg font-semibold tracking-tight">Discord</h2>
              <AdminDiscord @unauthorized="denied = true" />
            </template>

            <template v-else>
              <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 class="text-lg font-semibold tracking-tight">
                  Użytkownicy
                  <span class="ml-1 text-sm font-normal text-dimmed">{{ num(usersTotal) }}</span>
                </h2>
                <UButton
                  variant="ghost"
                  color="error"
                  size="sm"
                  icon="i-lucide-trash-2"
                  :loading="busy === 'purge'"
                  label="Usuń konta testowe"
                  @click="purgeTest"
                />
              </div>

              <UInput
                v-model="search"
                icon="i-lucide-search"
                size="lg"
                class="mb-4 w-full max-w-sm"
                placeholder="nick, e-mail albo konto Minecraft"
              />

              <div class="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                <table class="w-full min-w-[760px] text-left text-sm">
                  <thead class="text-xs text-dimmed">
                    <tr class="border-b border-white/10">
                      <th class="px-4 py-3 font-medium">Konto</th>
                      <th class="px-4 py-3 font-medium">Minecraft</th>
                      <th class="px-4 py-3 text-right font-medium">Znajomi</th>
                      <th class="px-4 py-3 text-right font-medium">Paczki</th>
                      <th class="px-4 py-3 font-medium">Dołączył</th>
                      <th class="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="user in users" :key="user.id" class="border-b border-white/5 last:border-0 align-middle">
                      <td class="px-4 py-3">
                        <div v-if="editing === user.id" class="flex flex-wrap gap-2">
                          <UInput v-model="draft.name" size="sm" placeholder="nazwa" class="w-36" />
                          <UInput v-model="draft.username" size="sm" placeholder="nick" class="w-32 font-mono" />
                        </div>

                        <div v-else class="flex items-center gap-3">
                          <img v-if="user.image" :src="user.image" alt="" class="size-8 shrink-0 rounded-full object-cover">
                          <span
                            v-else
                            class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                            :style="`background:hsl(${initialsAvatar(user.username || user.name || user.email).hue} 60% 30%)`"
                          >{{ initialsAvatar(user.username || user.name || user.email).letter }}</span>

                          <div class="min-w-0">
                            <div class="flex items-center gap-1.5">
                              <span class="truncate font-medium">{{ user.name || user.username || '—' }}</span>
                              <UIcon v-if="user.emailVerified" name="i-lucide-badge-check" class="size-3.5 shrink-0 text-primary" />
                              <UBadge v-if="user.banned" size="sm" color="error" variant="subtle" label="ban" />
                            </div>
                            <p class="truncate text-xs text-dimmed">{{ user.email }}</p>
                          </div>
                        </div>
                      </td>

                      <td class="px-4 py-3 font-mono text-xs text-muted">{{ user.mcUsername || '—' }}</td>
                      <td class="px-4 py-3 text-right font-mono text-xs">{{ num(user.friends) }}</td>
                      <td class="px-4 py-3 text-right font-mono text-xs">{{ num(user.shares) }}</td>
                      <td class="px-4 py-3 text-xs text-muted">{{ date(user.createdAt) }}</td>

                      <td class="px-4 py-3">
                        <div class="flex justify-end gap-1">
                          <template v-if="editing === user.id">
                            <UButton size="xs" color="neutral" :loading="busy === `user:${user.id}`" label="Zapisz" @click="saveUser(user)" />
                            <UButton size="xs" variant="ghost" color="neutral" label="Anuluj" @click="editing = null" />
                          </template>

                          <template v-else-if="confirmDelete === user.id">
                            <UButton size="xs" color="error" :loading="busy === `user:${user.id}`" label="Na pewno" @click="deleteUser(user)" />
                            <UButton size="xs" variant="ghost" color="neutral" label="Nie" @click="confirmDelete = null" />
                          </template>

                          <template v-else>
                            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" aria-label="Edytuj" @click="startEdit(user)" />
                            <UButton
                              size="xs"
                              variant="ghost"
                              :color="user.banned ? 'success' : 'warning'"
                              :icon="user.banned ? 'i-lucide-user-round-check' : 'i-lucide-ban'"
                              :aria-label="user.banned ? 'Odblokuj' : 'Zablokuj'"
                              :loading="busy === `user:${user.id}`"
                              @click="toggleBan(user)"
                            />
                            <UButton
                              size="xs"
                              variant="ghost"
                              color="error"
                              icon="i-lucide-trash-2"
                              aria-label="Usuń"
                              @click="confirmDelete = user.id"
                            />
                          </template>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p v-if="!users.length" class="px-4 py-8 text-center text-sm text-muted">Brak wyników.</p>
              </div>
            </template>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
