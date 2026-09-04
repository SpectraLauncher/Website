<script setup lang="ts">
import qrcode from 'qrcode-generator'

const { t } = useI18n()
const localePath = useLocalePath()
const auth = useAuthClient()
const session = useAuthSession()

const user = computed(() => session.value.data?.user as any)

watchEffect(() => {
  if (import.meta.client && !session.value.isPending && !session.value.data) {
    navigateTo(localePath('/login'))
  }
})

const busy = ref('')
const error = ref('')
const notice = ref('')

async function run(key: string, fn: () => Promise<any>) {
  busy.value = key
  error.value = ''
  notice.value = ''
  try {
    const res = await fn()
    if (res?.error) error.value = res.error.message || t('auth.genericError')
    return res
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || t('auth.genericError')
  }
  finally {
    busy.value = ''
  }
}

const TABS = [
  { id: 'profile', icon: 'i-lucide-user-round', label: 'account.profile' },
  { id: 'security', icon: 'i-lucide-shield-check', label: 'account.security' },
  { id: 'privacy', icon: 'i-lucide-eye-off', label: 'account.privacy' },
  { id: 'connected', icon: 'i-lucide-link', label: 'account.connected' },
  { id: 'friends', icon: 'i-lucide-users', label: 'friends.title' }
] as const

const tab = ref<(typeof TABS)[number]['id']>('profile')

const profile = reactive({ name: '', username: '', image: '' })

watch(user, (u) => {
  if (!u) return
  profile.name = u.name ?? ''
  profile.username = u.username ?? ''
  profile.image = u.image ?? ''
}, { immediate: true })

const avatar = computed(() => initialsAvatar(profile.username || profile.name))

const USERNAME_SHAPE = /^[a-zA-Z0-9_.]+$/
type UsernameState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

const usernameState = ref<UsernameState>('idle')
const usernameBlocked = computed(() => usernameState.value === 'taken' || usernameState.value === 'invalid')

let checkTimer: ReturnType<typeof setTimeout> | undefined

let latestCheck = 0

watch(() => profile.username, (value) => {
  clearTimeout(checkTimer)
  const username = value.trim()
  latestCheck++

  if (!username || username.toLowerCase() === (user.value?.username ?? '').toLowerCase()) {
    usernameState.value = 'idle'
    return
  }

  if (username.length < 3 || username.length > 30 || !USERNAME_SHAPE.test(username)) {
    usernameState.value = 'invalid'
    return
  }

  usernameState.value = 'checking'
  const token = latestCheck

  checkTimer = setTimeout(async () => {
    try {
      const res = await $fetch<{ available: boolean }>('/api/auth/is-username-available', {
        method: 'POST',
        body: { username }
      })
      if (token === latestCheck) usernameState.value = res.available ? 'available' : 'taken'
    }
    catch {
      if (token === latestCheck) usernameState.value = 'invalid'
    }
  }, 400)
})

onBeforeUnmount(() => clearTimeout(checkTimer))

const USERNAME_MESSAGES: Record<Exclude<UsernameState, 'idle'>, string> = {
  checking: 'account.usernameChecking',
  available: 'account.usernameAvailable',
  taken: 'account.usernameTaken',
  invalid: 'account.usernameInvalid'
}

const usernameMessage = computed(() =>
  usernameState.value === 'idle' ? '' : t(USERNAME_MESSAGES[usernameState.value]))

const AVATAR_PX = 256
const fileInput = ref<HTMLInputElement>()

const pickAvatar = () => fileInput.value?.click()

async function uploadAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  if (!IMAGE_TYPES.includes(file.type)) {
    error.value = t('account.avatarUnsupported')
    return
  }

  if (file.size > 8 * 1024 * 1024) {
    error.value = t('account.avatarTooBig')
    return
  }

  await run('avatar', async () => {
    const blob = await toSquareWebp(file, AVATAR_PX)
    const { url } = await $fetch<{ url: string }>('/api/me/avatar', {
      method: 'POST',
      body: blob,
      headers: { 'content-type': 'image/webp' }
    })
    profile.image = url
    notice.value = t('account.avatarUploaded')
  })
}

const saveProfile = () => run('profile', async () => {
  if (usernameBlocked.value) {
    error.value = t('account.usernameFix')
    return
  }

  const res = await auth.updateUser({
    name: profile.name,
    image: profile.image || null,
    username: profile.username
  } as any)

  if (!res?.error) notice.value = t('account.saved')
  return res
})

const FRIENDS_VISIBILITY = ['mutual', 'public'] as const
type FriendsVisibility = (typeof FRIENDS_VISIBILITY)[number]

const friendsVisibility = ref<FriendsVisibility>('mutual')

watch(user, (u) => {
  if (u) friendsVisibility.value = u.friendsVisibility === 'public' ? 'public' : 'mutual'
}, { immediate: true })

const savePrivacy = (value: FriendsVisibility) => run('privacy', async () => {
  friendsVisibility.value = value
  const res = await auth.updateUser({ friendsVisibility: value } as any)
  if (!res?.error) notice.value = t('account.saved')
  return res
})

const newEmail = ref('')

const resendVerification = () => run('verify', async () => {
  const res = await auth.sendVerificationEmail({
    email: user.value.email,
    callbackURL: localePath('/account')
  })
  if (!res?.error) notice.value = t('auth.verifyResent')
  return res
})

const changeEmail = () => run('email', async () => {
  const res = await auth.changeEmail({ newEmail: newEmail.value, callbackURL: localePath('/account') })
  if (!res?.error) notice.value = t('account.emailPending')
  return res
})

const pw = reactive({ current: '', next: '' })

const changePassword = () => run('password', async () => {
  const res = await auth.changePassword({
    currentPassword: pw.current,
    newPassword: pw.next,
    revokeOtherSessions: true
  })

  if (!res?.error) {
    notice.value = t('account.passwordChanged')
    pw.current = ''
    pw.next = ''
  }

  return res
})

const twoFa = reactive({ password: '', code: '', uri: '', backup: [] as string[] })

const qrSvg = computed(() => {
  if (!twoFa.uri) return ''
  const qr = qrcode(0, 'M')
  qr.addData(twoFa.uri)
  qr.make()
  return qr.createSvgTag({ cellSize: 4, margin: 1 })
})

const enable2fa = () => run('2fa', async () => {
  const res = await auth.twoFactor.enable({ password: twoFa.password })

  if (res?.data) {
    twoFa.uri = (res.data as any).totpURI
    twoFa.backup = (res.data as any).backupCodes ?? []
  }

  return res
})

const confirm2fa = () => run('2fa', async () => {
  const res = await auth.twoFactor.verifyTotp({ code: twoFa.code })

  if (!res?.error) {
    twoFa.uri = ''
    twoFa.code = ''
    notice.value = t('account.twoFaOn')
  }

  return res
})

const disable2fa = () => run('2fa', async () => {
  const res = await auth.twoFactor.disable({ password: twoFa.password })
  if (!res?.error) notice.value = t('account.twoFaOff')
  return res
})

const { data: providerList } = await useFetch<{ providers: string[] }>('/api/auth-providers')
const accounts = ref<any[]>([])

const loadAccounts = async () => {
  const res = await auth.listAccounts()
  accounts.value = (res.data ?? []) as any[]
}

onMounted(loadAccounts)

const linked = (id: string) => accounts.value.some(a => a.providerId === id || a.provider === id)
const link = (provider: string) => auth.linkSocial({ provider: provider as any, callbackURL: localePath('/account') })

const unlink = (provider: string) => run('link', async () => {
  const account = accounts.value.find(a => a.providerId === provider || a.provider === provider)
  if (!account) return void await loadAccounts()

  const res = await auth.unlinkAccount({ accountId: account.id })
  await loadAccounts()
  return res
})

interface PublicUser { id: string, name: string | null, username: string | null, image: string | null }
type Friend = PublicUser & { friendshipId: number }

const { data: friends, refresh: refreshFriends } = await useFetch<{
  friends: Friend[]
  incoming: { id: number, user: PublicUser }[]
  outgoing: { id: number, user: PublicUser }[]
}>('/api/friends', { server: false })

const friendQuery = ref('')

const addFriend = () => run('friend', async () => {
  await $fetch('/api/friends', { method: 'POST', body: { query: friendQuery.value } })
  friendQuery.value = ''
  notice.value = t('friends.requestSent')
  await refreshFriends()
})

const answer = (id: number, action: 'accept' | 'reject') => run('friend', async () => {
  await $fetch(`/api/friends/${id}`, { method: 'PATCH', body: { action } })
  await refreshFriends()
})

const removeFriend = (id: number) => run('friend', async () => {
  await $fetch(`/api/friends/${id}`, { method: 'DELETE' })
  await refreshFriends()
})

const label = (u: PublicUser) => u.username || u.name || '—'

const pendingCount = computed(() => friends.value?.incoming?.length ?? 0)

const signOut = async () => {
  await auth.signOut()
  await navigateTo(localePath('/'))
}

const PROVIDER_META: Record<string, { icon: string, label: string }> = {
  discord: { icon: 'i-simple-icons-discord', label: 'Discord' },
  google: { icon: 'i-simple-icons-google', label: 'Google' },
  github: { icon: 'i-simple-icons-github', label: 'GitHub' },
  microsoft: { icon: 'i-simple-icons-microsoft', label: 'Microsoft' }
}

const providerMeta = (id: string) => PROVIDER_META[id] ?? { icon: 'i-lucide-key-round', label: id }

useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
useSeoMeta({ title: () => `${t('account.title')}`, robots: 'noindex, nofollow' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-5xl px-4 pb-24 pt-28 sm:pt-40">
        <div class="mb-4 rounded-3xl border border-zinc-600/50 bg-black/30 p-6 backdrop-blur-sm">
          <div class="flex flex-wrap items-center gap-5">
            <button type="button" class="group relative shrink-0 cursor-pointer" @click="pickAvatar">
              <img
                v-if="profile.image"
                :src="profile.image"
                alt=""
                class="size-20 rounded-2xl object-cover"
              >
              <span
                v-else
                class="flex size-20 items-center justify-center rounded-2xl text-2xl font-bold"
                :style="`background:hsl(${avatar.hue} 60% 30%)`"
              >{{ avatar.letter }}</span>

              <span class="absolute inset-0 grid place-items-center rounded-2xl bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <UIcon :name="busy === 'avatar' ? 'i-lucide-loader-circle' : 'i-lucide-camera'" class="size-5" :class="busy === 'avatar' && 'animate-spin'" />
              </span>
            </button>

            <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="uploadAvatar">

            <div class="min-w-0 flex-1">
              <h1 class="truncate text-2xl font-semibold tracking-tight">{{ profile.name || profile.username || '—' }}</h1>
              <p v-if="profile.username" class="truncate font-mono text-sm text-muted">@{{ profile.username }}</p>

              <div class="mt-2 flex flex-wrap items-center gap-2">
                <span class="truncate text-sm text-muted">{{ user?.email }}</span>
                <UBadge
                  v-if="user"
                  size="sm"
                  variant="subtle"
                  :color="user.emailVerified ? 'success' : 'warning'"
                  :icon="user.emailVerified ? 'i-lucide-badge-check' : 'i-lucide-mail-warning'"
                  :label="user.emailVerified ? t('account.verified') : t('account.unverifiedBadge')"
                />
              </div>
            </div>

            <UButton
              v-if="profile.username"
              :to="localePath(`/u/${profile.username}`)"
              variant="subtle"
              color="neutral"
              size="lg"
              class="rounded-xl"
              icon="i-lucide-external-link"
              :label="t('account.viewProfile')"
            />

            <UButton
              variant="outline"
              color="neutral"
              size="lg"
              class="rounded-xl"
              icon="i-lucide-log-out"
              :label="t('account.signOut')"
              @click="signOut"
            />
          </div>
        </div>

        <UAlert
          v-if="user && !user.emailVerified"
          color="warning"
          variant="subtle"
          orientation="vertical"
          class="mb-4 rounded-3xl"
          icon="i-lucide-mail-warning"
          :title="t('auth.verifyTitle')"
          :description="`${t('account.unverified')} ${t('account.verifyWhy')}`"
        >
          <template #actions>
            <UButton
              color="warning"
              size="sm"
              class="rounded-lg"
              :loading="busy === 'verify'"
              :label="t('auth.verifyResend')"
              @click="resendVerification"
            />
          </template>
        </UAlert>

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
              <span class="whitespace-nowrap">{{ t(item.label) }}</span>
              <UBadge
                v-if="item.id === 'friends' && pendingCount"
                size="sm"
                color="primary"
                variant="solid"
                class="ml-auto"
                :label="`${pendingCount}`"
              />
            </button>
          </nav>

          <div class="p-6 lg:p-8">
            <template v-if="tab === 'profile'">
              <h2 class="mb-1 text-lg font-semibold tracking-tight">{{ t('account.profile') }}</h2>
              <p class="mb-6 text-sm text-muted">{{ t('account.uploadHint') }}</p>

              <div class="max-w-md space-y-4">
                <UFormField :label="t('account.displayName')">
                  <UInput v-model="profile.name" size="lg" class="w-full" />
                </UFormField>

                <UFormField :label="t('auth.username')" :error="usernameBlocked ? usernameMessage : undefined">
                  <UInput v-model="profile.username" size="lg" class="w-full" icon="i-lucide-at-sign">
                    <template #trailing>
                      <UIcon v-if="usernameState === 'checking'" name="i-lucide-loader-circle" class="size-4 animate-spin text-muted" />
                      <UIcon v-else-if="usernameState === 'available'" name="i-lucide-check" class="size-4 text-primary" />
                    </template>
                  </UInput>
                  <p v-if="usernameState === 'available'" class="mt-1.5 text-xs text-primary">{{ usernameMessage }}</p>
                </UFormField>

                <div class="flex flex-wrap gap-2 pt-1">
                  <UButton
                    color="neutral"
                    size="lg"
                    class="rounded-xl"
                    :loading="busy === 'profile'"
                    :disabled="usernameBlocked"
                    :label="t('account.save')"
                    @click="saveProfile"
                  />
                  <UButton
                    variant="ghost"
                    color="neutral"
                    size="lg"
                    class="rounded-xl"
                    icon="i-lucide-upload"
                    :loading="busy === 'avatar'"
                    :label="t('account.upload')"
                    @click="pickAvatar"
                  />
                </div>
              </div>
            </template>

            <template v-else-if="tab === 'security'">
              <h2 class="mb-6 text-lg font-semibold tracking-tight">{{ t('account.security') }}</h2>

              <div class="max-w-md space-y-8">
                <div>
                  <h3 class="mb-3 text-sm font-semibold">{{ t('account.changeEmail') }}</h3>
                  <div class="flex flex-wrap gap-2">
                    <UInput v-model="newEmail" type="email" size="lg" class="min-w-0 flex-1" :placeholder="t('account.newEmail')" />
                    <UButton
                      color="neutral"
                      size="lg"
                      class="rounded-xl"
                      :loading="busy === 'email'"
                      :disabled="!newEmail"
                      :label="t('account.changeEmail')"
                      @click="changeEmail"
                    />
                  </div>
                </div>

                <div>
                  <h3 class="mb-3 text-sm font-semibold">{{ t('account.changePassword') }}</h3>
                  <div class="space-y-2">
                    <UInput v-model="pw.current" type="password" autocomplete="current-password" size="lg" class="w-full" :placeholder="t('account.currentPassword')" />
                    <UInput v-model="pw.next" type="password" autocomplete="new-password" size="lg" class="w-full" :placeholder="t('account.newPassword')" />
                    <UButton
                      color="neutral"
                      size="lg"
                      class="rounded-xl"
                      :loading="busy === 'password'"
                      :disabled="!pw.current || pw.next.length < 8"
                      :label="t('account.changePassword')"
                      @click="changePassword"
                    />
                  </div>
                </div>

                <div class="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div class="mb-1 flex items-center gap-2">
                    <h3 class="text-sm font-semibold">{{ t('account.twoFactor') }}</h3>
                    <UBadge
                      size="sm"
                      variant="subtle"
                      :color="user?.twoFactorEnabled ? 'success' : 'neutral'"
                      :label="user?.twoFactorEnabled ? t('account.on') : t('account.off')"
                    />
                  </div>
                  <p class="mb-4 text-xs/relaxed text-muted">{{ t('account.twoFactorHint') }}</p>

                  <template v-if="twoFa.uri">
                    <p class="mb-3 text-xs/relaxed text-muted">{{ t('account.scanHint') }}</p>
                    <div class="mb-4 w-fit rounded-xl bg-white p-3" v-html="qrSvg"></div>

                    <div v-if="twoFa.backup.length" class="mb-4">
                      <p class="mb-2 text-xs text-dimmed">{{ t('account.backupCodes') }}</p>
                      <div class="grid grid-cols-2 gap-1.5 font-mono text-xs">
                        <span v-for="code in twoFa.backup" :key="code" class="rounded-lg bg-white/5 px-2 py-1.5">{{ code }}</span>
                      </div>
                    </div>

                    <div class="flex flex-wrap gap-2">
                      <UInput v-model="twoFa.code" inputmode="numeric" size="lg" placeholder="000000" class="w-32 font-mono" />
                      <UButton color="neutral" size="lg" class="rounded-xl" :loading="busy === '2fa'" :label="t('auth.verify')" @click="confirm2fa" />
                    </div>
                  </template>

                  <div v-else class="flex flex-wrap gap-2">
                    <UInput v-model="twoFa.password" type="password" size="lg" class="min-w-0 flex-1" :placeholder="t('account.currentPassword')" />
                    <UButton
                      v-if="user?.twoFactorEnabled"
                      color="error"
                      variant="subtle"
                      size="lg"
                      class="rounded-xl"
                      :loading="busy === '2fa'"
                      :disabled="!twoFa.password"
                      :label="t('account.disable')"
                      @click="disable2fa"
                    />
                    <UButton
                      v-else
                      color="neutral"
                      size="lg"
                      class="rounded-xl"
                      :loading="busy === '2fa'"
                      :disabled="!twoFa.password"
                      :label="t('account.enable')"
                      @click="enable2fa"
                    />
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="tab === 'privacy'">
              <h2 class="mb-1 text-lg font-semibold tracking-tight">{{ t('account.privacy') }}</h2>
              <p class="mb-6 text-sm text-muted">{{ t('account.privacyHint') }}</p>

              <div class="max-w-md">
                <h3 class="mb-3 text-sm font-semibold">{{ t('account.friendsVisibility') }}</h3>

                <div class="space-y-2">
                  <button
                    v-for="value in FRIENDS_VISIBILITY"
                    :key="value"
                    type="button"
                    class="flex w-full cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition-colors"
                    :class="friendsVisibility === value
                      ? 'border-zinc-400 bg-white/5'
                      : 'border-white/10 bg-black/20 hover:border-zinc-500'"
                    :disabled="busy === 'privacy'"
                    @click="savePrivacy(value)"
                  >
                    <UIcon
                      :name="friendsVisibility === value ? 'i-lucide-circle-check' : 'i-lucide-circle'"
                      class="mt-0.5 size-4 shrink-0"
                      :class="friendsVisibility === value ? 'text-primary' : 'text-dimmed'"
                    />
                    <span class="min-w-0">
                      <span class="block text-sm font-medium">{{ t(`account.friendsVisibilityOptions.${value}.title`) }}</span>
                      <span class="block text-xs/relaxed text-muted">{{ t(`account.friendsVisibilityOptions.${value}.body`) }}</span>
                    </span>
                  </button>
                </div>
              </div>
            </template>

            <template v-else-if="tab === 'connected'">
              <h2 class="mb-6 text-lg font-semibold tracking-tight">{{ t('account.connected') }}</h2>

              <div class="max-w-md space-y-2">
                <div
                  v-for="id in (providerList?.providers ?? [])"
                  :key="id"
                  class="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <UIcon :name="providerMeta(id).icon" class="size-5 shrink-0" />
                  <span class="flex-1 text-sm font-medium">{{ providerMeta(id).label }}</span>
                  <UBadge v-if="linked(id)" size="sm" variant="subtle" color="success" :label="t('account.linked')" />
                  <UButton
                    v-if="linked(id)"
                    variant="ghost"
                    color="neutral"
                    size="sm"
                    :loading="busy === 'link'"
                    :label="t('account.unlink')"
                    @click="unlink(id)"
                  />
                  <UButton
                    v-else
                    variant="subtle"
                    color="neutral"
                    size="sm"
                    :label="t('account.link')"
                    @click="link(id)"
                  />
                </div>

                <p v-if="!(providerList?.providers ?? []).length" class="text-sm text-muted">—</p>
              </div>
            </template>

            <template v-else>
              <h2 class="mb-6 text-lg font-semibold tracking-tight">{{ t('friends.title') }}</h2>

              <div class="max-w-md space-y-6">
                <form class="flex flex-wrap gap-2" @submit.prevent="addFriend">
                  <UInput v-model="friendQuery" size="lg" class="min-w-0 flex-1" :placeholder="t('friends.addPlaceholder')" />
                  <UButton
                    type="submit"
                    color="neutral"
                    size="lg"
                    class="rounded-xl"
                    :loading="busy === 'friend'"
                    :disabled="!friendQuery"
                    :label="t('friends.add')"
                  />
                </form>

                <div v-if="friends?.incoming?.length">
                  <h3 class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('friends.incoming') }}</h3>
                  <div class="space-y-2">
                    <div
                      v-for="req in friends.incoming"
                      :key="req.id"
                      class="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5"
                    >
                      <span class="flex-1 truncate text-sm">{{ label(req.user) }}</span>
                      <UButton size="sm" color="neutral" variant="subtle" :label="t('friends.accept')" @click="answer(req.id, 'accept')" />
                      <UButton size="sm" color="neutral" variant="ghost" :label="t('friends.reject')" @click="answer(req.id, 'reject')" />
                    </div>
                  </div>
                </div>

                <div v-if="friends?.outgoing?.length">
                  <h3 class="mb-2 text-xs uppercase tracking-[0.12em] text-dimmed">{{ t('friends.outgoing') }}</h3>
                  <div class="space-y-2">
                    <div
                      v-for="req in friends.outgoing"
                      :key="req.id"
                      class="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5"
                    >
                      <span class="flex-1 truncate text-sm">{{ label(req.user) }}</span>
                      <span class="text-xs text-dimmed">{{ t('friends.pending') }}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div v-if="friends?.friends?.length" class="space-y-2">
                    <div
                      v-for="friend in friends.friends"
                      :key="friend.friendshipId"
                      class="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5"
                    >
                      <img v-if="friend.image" :src="friend.image" alt="" class="size-8 rounded-full object-cover">
                      <span
                        v-else
                        class="flex size-8 items-center justify-center rounded-full text-xs font-bold"
                        :style="`background:hsl(${initialsAvatar(label(friend)).hue} 60% 30%)`"
                      >{{ initialsAvatar(label(friend)).letter }}</span>

                      <span class="flex-1 truncate text-sm">{{ label(friend) }}</span>

                      <UButton
                        size="sm"
                        variant="ghost"
                        color="neutral"
                        icon="i-lucide-user-round-minus"
                        :aria-label="t('friends.remove')"
                        @click="removeFriend(friend.friendshipId)"
                      />
                    </div>
                  </div>
                  <p v-else class="text-sm/relaxed text-muted">{{ t('friends.empty') }}</p>
                </div>
              </div>
            </template>
          </div>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          class="my-4"
          icon="i-lucide-circle-alert"
          :description="error"
        />
        <UAlert
          v-if="notice"
          color="success"
          variant="subtle"
          class="my-4"
          icon="i-lucide-check"
          :description="notice"
        />

      </section>
    </div>
  </div>
</template>
