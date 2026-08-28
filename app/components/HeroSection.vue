<script setup lang="ts">
const localePath = useLocalePath()
const { data: release } = useLauncherVersion()
const os = useOs()
const { t } = useI18n()


const primaryHref = computed(() => {
  const dl = release.value?.downloads
  const fallback = release.value?.releasesUrl || GITHUB_REPO
  if (!dl) return fallback
  if (os.value === 'macOS') return dl.macArm
  if (os.value === 'Linux') return dl.linuxAppImage
  return dl.winInstaller // Windows (default)
})


const titleWords = computed(() => [
  ...t('hero.title1').split(' ').map(w => ({ w, hl: false, punct: '' })),
  { w: t('hero.title2'), hl: true, punct: ',' },
  ...t('hero.title3').split(' ').map(w => ({ w, hl: false, punct: '' }))
])

const COUNT = 75          // public/frames/f_0001.webp … f_0075.webp
const W = 1280            // rozmiar klatki — bufor canvasa, CSS skaluje
const H = 720


const root = useTemplateRef<HTMLElement>('root')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

onMounted(() => {
  const { $gsap, $ScrollTrigger } = useNuxtApp()
  const ctx = canvas.value!.getContext('2d')!
  const images: HTMLImageElement[] = []

  const render = (i: number) => {
    const img = images[i]
    if (!img?.complete || !img.naturalWidth) return
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(img, 0, 0, W, H)
  }

  for (let i = 1; i <= COUNT; i++) {
    const img = new Image()
    img.src = `/frames/f_${String(i).padStart(4, '0')}.webp`
    if (i === 1) img.onload = () => render(0)
    images.push(img)
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  $gsap.from(root.value!.querySelectorAll('[data-word]'), {
    yPercent: 118, opacity: 0, duration: 0.95, ease: 'expo.out', stagger: 0.05,
    clearProps: 'transform,opacity'
  })
  $gsap.from(root.value!.querySelectorAll('[data-anim="hero"]'), {
    y: 22, opacity: 0, duration: 0.7, ease: 'power2.out', stagger: 0.07, delay: 0.15,
    clearProps: 'transform,opacity'
  })

  const state = { frame: 0 }
  const tween = $gsap.to(state, {
    frame: COUNT - 1,
    snap: 'frame',
    ease: 'none',
    onUpdate: () => render(state.frame),
    scrollTrigger: {
      trigger: root.value,
      start: 'top top',
      end: `+=${HERO_SCROLL}`,
      pin: true,
      scrub: 0.5
    }
  })

  onUnmounted(() => {
    tween.scrollTrigger?.kill()
    tween.kill()
    $ScrollTrigger.refresh()
  })
})
</script>

<template>
    <div ref="root" class="relative pt-32 md:pt-48">
        <div class="absolute inset-0 -z-10 bg-[url('/bg.webp')] bg-center bg-no-repeat bg-cover mask-b-from-50% mask-b-to-100%"></div>


        <div class="container mx-auto flex flex-col items-center px-4 text-center">

            <div data-anim="hero" class="flex w-fit max-w-full items-center gap-2 rounded-full border border-zinc-600/50 bg-black/10 px-3 py-2 text-xs sm:text-sm">
                <UChip standalone inset color="success" class="animate-pulse" />
                <div>
                    <p class="text-muted">Launcher <span class="text-white">v{{ release?.version || '…' }}</span> · open beta<span class="hidden sm:inline"> · {{ DISCORD_MEMBERS }} members</span></p>
                </div>
            </div>
            <h1 class="mb-6 flex flex-wrap justify-center gap-x-[0.26em] text-4xl font-semibold sm:text-6xl lg:text-7xl xl:text-8xl">
                <span v-for="(word, i) in titleWords" :key="i" class="inline-block overflow-hidden pb-[0.08em]">
                    <span data-word class="inline-block"><span v-if="word.hl" class="cpface">{{ word.w }}</span><template v-else>{{ word.w }}</template>{{ word.punct }}</span>
                </span>
            </h1>

            <i18n-t data-anim="hero" keypath="hero.subtitle" tag="p" scope="global" class="mb-6 max-w-[60ch] text-base text-muted sm:text-lg lg:text-xl">
                <template #br><br class="hidden lg:inline"></template>
            </i18n-t>

            <div data-anim="hero" class="z-10 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5">
                <NuxtLink
                    :to="primaryHref"
                    target="_blank"
                    rel="noreferrer"
                    class="inline-flex items-center justify-center gap-3 rounded-[13px] px-6 py-4 text-[16px] font-bold no-underline transition-transform hover:-translate-y-0.5"
                    style="color:#04121f;background:linear-gradient(135deg,#7dd3fc,#38bdf8 55%,#0ea5e9);box-shadow:0 10px 34px rgba(56,189,248,.38)"
                >
                    <UIcon name="i-lucide-download" size="20" color="neutral" />
                {{ t('hero.downloadFor', { os }) }}
                </NuxtLink>
                <NuxtLink
                    :to="localePath('/launcher') + '#downloads'"
                    class="inline-flex items-center justify-center gap-2 rounded-[13px] border border-white/[0.14] px-5.5 py-3.75 text-[16px] font-semibold no-underline transition-colors hover:border-[rgba(125,211,252,.45)]"
                    style="color:#eaf1fb;background:rgba(255,255,255,.03)"
                >{{ t('hero.allPlatforms') }}</NuxtLink>
            </div>

            
            <canvas ref="canvas" data-anim="hero" :width="W" :height="H" class="relative -top-4 w-full md:-top-8" />


        </div>
    </div>
</template>

<style>
.cpface {
    cursor: url('/cp-face-cursor.png') 16 16, auto;
    position: relative;
    isolation: isolate;
}

.cpface::after {
    content: '';
    position: absolute;
    inset: 0.14em -0.06em 0.06em;
    z-index: -1;
    background: url('grass.webp');
    background-repeat: repeat-x;
    background-position: left;
    background-size: contain;
    opacity: 0;
    transition: opacity 100ms ease-out;
}

.cpface:hover::after {
    opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
    .cpface::after { transition: none; }
}
</style>