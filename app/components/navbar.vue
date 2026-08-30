<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const localePath = useLocalePath()

const session = useAuthSession()
const me = computed(() => session.value.data?.user as { username?: string, name?: string, image?: string } | undefined)

const { t, locale, locales, setLocale } = useI18n()

const langs = computed(() => locales.value.map(l => ({ label: l.name!, value: l.code })))
const lang = computed({
    get: () => locale.value,
    set: (code: string) => setLocale(code as 'en' | 'pl')
})

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

const items = ref<NavigationMenuItem[]>([
    { label: 'nav.launcher', to: localePath('/launcher') },
    { label: 'nav.tools', to: localePath('/tools') },
    {
        label: 'nav.community',
        children: [
            { label: 'Badges', icon: 'i-lucide-award', to: localePath('/badges'), description: 'nav.badgesDesc' },
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

const localized = computed(() => tr(items.value))

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
                    <USelect 
                        v-model="lang"
                        :items="langs"
                        value-key="value"
                        icon="i-lucide-languages"
                        variant="ghost"
                        color="neutral"
                        :ui="{ base: 'rounded-xl cursor-pointer' }"
                        class="w-32"
                    />
                    <UButton
                        v-if="me"
                        :to="localePath('/account')"
                        :label="me.username || me.name"
                        :avatar="me.image ? { src: me.image } : undefined"
                        :icon="me.image ? undefined : 'i-lucide-user-round'"
                        variant="ghost"
                        color="neutral"
                        class="rounded-xl cursor-pointer"
                    />
                    <UButton
                        v-else
                        :to="localePath('/login')"
                        :label="t('nav.login')"
                        variant="solid"
                        color="neutral"
                        icon="i-lucide-log-in"
                        class="rounded-xl cursor-pointer"
                    />
                </div>

                <UButton
                    class="rounded-xl lg:hidden"
                    variant="ghost"
                    color="neutral"
                    size="lg"
                    :icon="menuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
                    :aria-label="t('nav.menu')"
                    @click="menuOpen = !menuOpen"
                />
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
                            <USelect
                                v-model="lang"
                                :items="langs"
                                value-key="value"
                                icon="i-lucide-languages"
                                variant="soft"
                                color="neutral"
                                class="w-full"
                                :ui="{ base: 'rounded-xl cursor-pointer' }"
                            />
                            <UButton
                                v-if="me"
                                :to="localePath('/account')"
                                :label="me.username || me.name"
                                :avatar="me.image ? { src: me.image } : undefined"
                                :icon="me.image ? undefined : 'i-lucide-user-round'"
                                variant="soft"
                                color="neutral"
                                block
                                class="rounded-xl"
                            />
                            <UButton
                                v-else
                                :to="localePath('/login')"
                                :label="t('nav.login')"
                                variant="solid"
                                color="neutral"
                                icon="i-lucide-log-in"
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
