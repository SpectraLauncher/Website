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

// Through the ladder, never a literal: comparing to 'admin' hid the panel
// from the owner the moment roles gained a rung above it.
const isAdmin = computed(() => isStaff(me.value))

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

// The same registry the account panel's sidebar draws, cut into the groups this
// dropdown shows. One list is what stops the two drifting apart, which they did
// twice: "My reports" reached the menu and not the panel, /library the reverse.
const accountNav = useAccountNav()

// Above the divider: yourself, and the two places you go to change something
// about yourself. Everything else is what you make here.
const ACCOUNT_FIRST = new Set(['profile', 'notifications', 'settings'])

const accountMenu = computed(() => {
    if (!me.value) return []

    const link = (item: SideNavItem) => ({ label: item.label, icon: item.icon, to: item.to })
    const mine = accountNav.value.filter(item => ACCOUNT_FIRST.has(item.id)).map(link)
    const made = accountNav.value.filter(item => !ACCOUNT_FIRST.has(item.id)).map(link)

    const out = [mine]
    if (made.length) out.push(made)
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
                            :to="localePath('/dashboard/notifications')"
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
                        :to="localePath('/auth/login')"
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
                                :to="localePath('/auth/login')"
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
