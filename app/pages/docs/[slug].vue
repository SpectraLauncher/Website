<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const docContent = useDocContent()

const slug = computed(() => String(route.params.slug ?? ''))
const known = computed(() => isDocPage(slug.value))

const source = computed(() => (known.value ? docContent(slug.value) : null))
const body = computed(() => (source.value ? renderMarkdown(source.value) : ''))

const around = computed(() => neighbours(slug.value))

const title = computed(() =>
  known.value ? t(`docs.pages.${slug.value}.title`) : t('docs.notFound'))

useSeoMeta({
  title,
  description: () => (known.value ? t(`docs.pages.${slug.value}.summary`) : ''),
  robots: () => (known.value ? 'index,follow' : 'noindex,nofollow'),
})
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="mx-auto max-w-6xl px-4 pb-24 pt-40">
        <div class="grid gap-8 lg:grid-cols-[240px_1fr] lg:items-start">
          <nav class="lg:sticky lg:top-24">
            <NuxtLink
              :to="localePath('/docs')"
              class="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-default"
            >
              <UIcon name="i-pixelarticons-arrow-left" class="size-4" />
              {{ t('docs.title') }}
            </NuxtLink>

            <div v-for="section in DOC_SECTIONS" :key="section.id" class="mb-5">
              <p class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dimmed">
                <UIcon :name="section.icon" class="size-3.5" />
                {{ t(`docs.sections.${section.id}`) }}
              </p>
              <ul class="space-y-0.5">
                <li v-for="item in section.pages" :key="item">
                  <NuxtLink
                    :to="localePath(`/docs/${item}`)"
                    class="block rounded-lg px-2.5 py-1.5 text-sm transition-colors"
                    :class="item === slug
                      ? 'bg-white/10 font-medium text-default'
                      : 'text-muted hover:bg-white/5 hover:text-default'"
                  >
                    {{ t(`docs.pages.${item}.title`) }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
          </nav>

          <article class="min-w-0">
            <template v-if="known && body">
              <h1 class="mb-2 text-3xl font-semibold tracking-tight">{{ title }}</h1>
              <p class="mb-8 text-muted">{{ t(`docs.pages.${slug}.summary`) }}</p>

              <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false -->
              <div
                class="prose prose-invert max-w-none break-words prose-headings:scroll-mt-24 prose-a:text-primary"
                v-html="body"
              />

              <div class="mt-12 flex flex-wrap gap-3 border-t border-white/10 pt-6">
                <UButton
                  v-if="around.previous"
                  variant="ghost"
                  color="neutral"
                  icon="i-pixelarticons-arrow-left"
                  class="rounded-xl"
                  :to="localePath(`/docs/${around.previous}`)"
                  :label="t(`docs.pages.${around.previous}.title`)"
                />
                <span class="flex-1"></span>
                <UButton
                  v-if="around.next"
                  variant="ghost"
                  color="neutral"
                  trailing-icon="i-pixelarticons-arrow-right"
                  class="rounded-xl"
                  :to="localePath(`/docs/${around.next}`)"
                  :label="t(`docs.pages.${around.next}.title`)"
                />
              </div>
            </template>

            <div v-else class="rounded-3xl border border-white/10 p-12 text-center">
              <UIcon name="i-pixelarticons-file-alt" class="mx-auto size-10 text-dimmed" />
              <h1 class="mt-4 text-xl font-semibold">{{ t('docs.notFound') }}</h1>
              <UButton
                class="mt-4 rounded-xl"
                variant="ghost"
                color="neutral"
                :to="localePath('/docs')"
                :label="t('docs.title')"
              />
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
