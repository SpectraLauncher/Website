<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const localePath = useLocalePath()

const auth = useAuthClient()
const session = useAuthSession()
const me = computed(() => session.value.data?.user as { username?: string, name?: string, image?: string, role?: string | null } | undefined)

const { t } = useI18n()

const route = useRoute()

const PINNED_HERO = ['index']

const hasPinnedHero = computed(() => {
  const name = String(route.name ?? '').split('___')[0]
  return PINNED_HERO.includes(name)
})

const threshold = computed(() => (hasPinnedHero.value ? HERO_SCROLL + 600 : 100))

const scrolled = ref(false)
onMounted(() => {
    const onScroll = () => { scrolled.value = window.scrollY > threshold.value }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    onUnmounted(() => window.removeEventListener('scroll', onScroll))
})

const isAdmin = computed(() => me.value?.role === 'admin')

// While the catalog is closed it exists for the admin alone, and the server
// serves it to them — so the navigation has to reach it too, or the only way in
// is typing the address.
const catalogVisible = computed(() =>
    useRuntimeConfig().public.catalogPublic === true || isAdmin.value)

// Signing in is not enough: while the catalog is closed only the admin can put
// anything into it, and a button that always answers 404 is worse than none.
const canPublish = computed(() => Boolean(me.value) && catalogVisible.value)

const cart = useCart()
const creating = useCreateFlows()

const publishMenu = computed(() => [
    {
        label: t('create.project.title'),
        icon: 'i-pixelarticons-package',
        onSelect: () => { creating.project.value = true },
    },
    {
        label: t('create.organization.title'),
        icon: 'i-pixelarticons-users',
        onSelect: () => { creating.organization.value = true },
    },
    {
        label: t('create.collection.title'),
        icon: 'i-pixelarticons-bookmark',
        onSelect: () => { creating.collection.value = true },
    },
])

const { unread, refresh: refreshNotifications } = useNotifications()

watch(me, (user) => {
    if (user) refreshNotifications()
}, { immediate: true })

const discover: NavigationMenuItem = {
    label: 'nav.discover',
    children: [
        { label: 'nav.mods', icon: 'i-pixelarticons-shapes', to: localePath('/mod'), description: 'nav.modsDesc' },
        { label: 'nav.plugins', icon: 'i-pixelarticons-plug', to: localePath('/plugin'), description: 'nav.pluginsDesc' },
        { label: 'nav.resourcepacks', icon: 'i-pixelarticons-image', to: localePath('/resourcepack'), description: 'nav.resourcepacksDesc' },
        { label: 'nav.shaders', icon: 'i-pixelarticons-sun', to: localePath('/shader'), description: 'nav.shadersDesc' },
        { label: 'nav.modpacks', icon: 'i-pixelarticons-archive', to: localePath('/pack'), description: 'nav.modpacksDesc' },
        { label: 'nav.schematics', icon: 'i-pixelarticons-blocks', to: localePath('/schematic'), description: 'nav.schematicsDesc' },
    ]
}

const items = ref<NavigationMenuItem[]>([
    { label: 'nav.launcher', to: localePath('/launcher') },
    { label: 'nav.tools', to: localePath('/tools') },
    {
        label: 'nav.community',
        children: [
            { label: 'Badges', icon: 'i-pixelarticons-trophy', to: localePath('/badges'), description: 'nav.badgesDesc' },
            { label: 'GitHub', icon: 'i-simple-icons-github', target: '_blank', to: 'https://github.com/SpectraLauncher', description: 'nav.githubDesc' },
            { label: 'Discord', icon: 'i-simple-icons-discord', target: '_blank', to: DISCORD_INVITE, description: 'nav.discordDesc' },
        ]
    },
])

const tr = (list: NavigationMenuItem[]): NavigationMenuItem[] => list.map(i => ({
    ...i,
    label: i.label?.startsWith('nav.') ? t(i.label) : i.label,
    ...(i.description?.startsWith('nav.') && { description: t(i.description) }),
    ...(i.children && { children: tr(i.children as NavigationMenuItem[]) })
}))

// Hidden rather than guarded: the server already answers 404 to these routes
// while the catalog is closed, so this only avoids linking somewhere broken.
const accountMenu = computed(() => {
    const user = me.value
    if (!user) return []

    const account = [
        { label: t('nav.account.profile'), icon: 'i-pixelarticons-user', to: localePath(`/u/${user.username}`) },
        { label: t('nav.account.notifications'), icon: 'i-pixelarticons-bell', to: localePath('/notifications') },
        { label: t('nav.account.settings'), icon: 'i-pixelarticons-gear', to: localePath('/settings') },
    ]

    const creating = catalogVisible.value
        ? [
            { label: t('nav.account.projects'), icon: 'i-pixelarticons-package', to: localePath('/projects') },
            { label: t('nav.account.collections'), icon: 'i-pixelarticons-bookmark', to: localePath('/collections') },
            { label: t('nav.account.organizations'), icon: 'i-pixelarticons-users', to: localePath('/organizations') },
                { label: t('nav.account.analytics'), icon: 'i-pixelarticons-chart-line', to: localePath('/analytics') },
            { label: t('nav.account.library'), icon: 'i-pixelarticons-library', to: localePath('/library') },
            { label: t('nav.account.revenue'), icon: 'i-pixelarticons-chart', to: localePath('/revenue') },
            { label: t('nav.account.seller'), icon: 'i-pixelarticons-wallet', to: localePath('/seller') },
            { label: t('reports.mine'), icon: 'i-pixelarticons-flag', to: localePath('/reports') },
        ]
        : []

    const out = [account]
    if (creating.length) out.push(creating)
    if (isAdmin.value) out.push([{ label: t('nav.account.admin'), icon: 'i-pixelarticons-shield', to: localePath('/admin') }])
    out.push([{ label: t('nav.account.signOut'), icon: 'i-pixelarticons-logout', onSelect: signOut }])
    return out
})

async function signOut() {
    await auth.signOut()
    await navigateTo(localePath('/'))
}

const localized = computed(() =>
    tr(catalogVisible.value ? [discover, ...items.value] : items.value))

const menuOpen = ref(false)
watch(() => route.fullPath, () => { menuOpen.value = false })

defineExpose({ items })
</script>

<template>
    <div class="fixed w-full z-100 transition-[top] duration-300 ease-out" :class="scrolled ? 'top-2 md:top-4' : 'top-4 md:top-12'">
        <div class="container relative mx-auto px-4 py-3 rounded-3xl border border-zinc-600/50">

            <div class="absolute inset-0 rounded-3xl bg-black/30 backdrop-blur-sm"></div>

            <div class="relative w-full flex justify-between items-center">
                <NuxtLink :to="localePath('/')" class="flex items-center">
                    <img src="/logo-transparent.png" alt="Logo" class="h-8 md:h-10" />
                    <p class="ml-2 text-lg font-bold md:text-xl">Spectra</p>
                </NuxtLink>

                <div id="nav" class="hidden lg:block">
                    <UNavigationMenu
                        :items="localized"
                        content-orientation="vertical"
                        :ui="{
                            viewport: 'sm:w-(--reka-navigation-menu-viewport-width) overflow-hidden',
                            content: 'min-w-72',
                            childLink: 'gap-3 p-3',
                            childLinkDescription: 'text-wrap'
                        }"
                    />
                </div>

                <div class="hidden gap-3 items-center lg:flex">
                    <SiteCartButton />
                    <UDropdownMenu
                        v-if="canPublish"
                        :items="publishMenu"
                        :content="{ align: 'end' }"
                        :ui="{ content: 'w-56 rounded-2xl' }"
                    >
                        <UButton
                            color="primary"
                            variant="solid"
                            class="rounded-xl"
                            icon="i-pixelarticons-plus"
                            trailing-icon="i-pixelarticons-chevron-down"
                            :label="t('nav.publish')"
                        />
                    </UDropdownMenu>
                    <UChip
                        v-if="me"
                        :show="unread > 0"
                        :text="unread > 99 ? '99+' : unread"
                        size="xl"
                        color="primary"
                    >
                        <UButton
                            :to="localePath('/notifications')"
                            icon="i-pixelarticons-bell"
                            variant="ghost"
                            color="neutral"
                            :aria-label="t('nav.account.notifications')"
                            class="rounded-xl cursor-pointer"
                        />
                    </UChip>
                    <UDropdownMenu
                        v-if="me"
                        :items="accountMenu"
                        :content="{ align: 'end' }"
                        :ui="{ content: 'w-56' }"
                    >
                        <UButton
                            :label="me.username || me.name"
                            :avatar="me.image ? { src: me.image } : undefined"
                            :icon="me.image ? undefined : 'i-pixelarticons-avatar-circle'"
                            trailing-icon="i-pixelarticons-chevron-down"
                            variant="ghost"
                            color="neutral"
                            class="rounded-xl cursor-pointer"
                        />
                    </UDropdownMenu>
                    <UButton
                        v-else
                        :to="localePath('/login')"
                        :label="t('nav.login')"
                        variant="solid"
                        color="neutral"
                        icon="i-pixelarticons-login"
                        class="rounded-xl cursor-pointer"
                    />
                </div>

                <div class="flex items-center gap-1 lg:hidden">
                    <!-- No hover on a phone, so this one goes straight to the
                         cart rather than opening a popover nobody can trigger. -->
                    <UChip
                        v-if="cart.count.value > 0"
                        :text="cart.count.value"
                        size="xl"
                        color="primary"
                    >
                        <UButton
                            :to="localePath('/cart')"
                            icon="i-pixelarticons-cart"
                            variant="ghost"
                            color="neutral"
                            size="lg"
                            class="rounded-xl"
                            :aria-label="t('cart.title')"
                        />
                    </UChip>

                    <UButton
                        class="rounded-xl"
                        variant="ghost"
                        color="neutral"
                        size="lg"
                        :icon="menuOpen ? 'i-pixelarticons-close' : 'i-pixelarticons-menu'"
                        :aria-label="t('nav.menu')"
                        @click="menuOpen = !menuOpen"
                    />
                </div>
            </div>

            <div
                class="relative grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out lg:hidden"
                :class="menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
            >
                <div class="min-h-0">
                    <div class="mt-3 flex flex-col gap-4 border-t border-white/10 pt-4">
                        <UNavigationMenu
                            :items="localized"
                            orientation="vertical"
                            class="w-full"
                            :ui="{ childLink: 'gap-3 p-3', childLinkDescription: 'text-wrap' }"
                        />

                        <div class="flex flex-col gap-2">
                            <UButton
                                v-for="entry in (canPublish ? publishMenu : [])"
                                :key="entry.label"
                                :to="entry.to"
                                :label="entry.label"
                                :icon="entry.icon"
                                variant="soft"
                                color="primary"
                                class="w-full rounded-xl"
                                @click="entry.onSelect?.()"
                            />
                            <template v-if="me">
                                <UButton
                                    v-for="entry in accountMenu.flat()"
                                    :key="entry.label"
                                    :to="entry.to"
                                    :label="entry.label"
                                    :icon="entry.icon"
                                    variant="ghost"
                                    color="neutral"
                                    block
                                    class="justify-start rounded-xl"
                                    @click="entry.onSelect?.()"
                                />
                            </template>
                            <UButton
                                v-else
                                :to="localePath('/login')"
                                :label="t('nav.login')"
                                variant="solid"
                                color="neutral"
                                icon="i-pixelarticons-login"
                                block
                                class="rounded-xl"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
