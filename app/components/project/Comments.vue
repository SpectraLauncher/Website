<script setup lang="ts">
interface CommentAuthor {
  id: string
  name: string | null
  username: string | null
  image: string | null
}

interface Comment {
  id: string
  parentId: string | null
  body: string
  hidden: boolean
  created: number
  updated: number | null
  author: CommentAuthor
  replies: Comment[]
}

const props = defineProps<{ slug: string }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()
const session = useAuthSession()

const me = computed(() => session.value.data?.user as { id?: string, role?: string } | undefined)
const isStaff = computed(() => me.value?.role === 'admin')

const comments = ref<Comment[]>([])
const loaded = ref(false)
const error = ref('')
const busy = ref('')

const draft = ref('')
const replyTo = ref<string | null>(null)
const replyDraft = ref('')

const MAX = 4000

async function load() {
  try {
    const res = await $fetch<{ comments: Comment[] }>(`/api/catalog/project/${props.slug}/comments`)
    comments.value = res.comments
  }
  catch {
    comments.value = []
  }
  finally {
    loaded.value = true
  }
}

onMounted(load)

const total = computed(() =>
  comments.value.reduce((sum, c) => sum + 1 + c.replies.length, 0))

async function send(body: string, parentId: string | null) {
  const text = body.trim()
  if (!text) return

  busy.value = parentId ?? 'root'
  error.value = ''
  try {
    await $fetch(`/api/catalog/project/${props.slug}/comments`, {
      method: 'POST',
      body: { body: text, parentId },
    })
    if (parentId) {
      replyDraft.value = ''
      replyTo.value = null
    }
    else {
      draft.value = ''
    }
    await load()
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = ''
  }
}

async function remove(id: string) {
  busy.value = id
  try {
    await $fetch(`/api/catalog/comment/${id}`, { method: 'DELETE' })
    await load()
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || t('auth.genericError')
  }
  finally {
    busy.value = ''
  }
}

const canRemove = (comment: Comment) => isStaff.value || comment.author.id === me.value?.id
const when = (ms: number) => new Date(ms).toLocaleString(locale.value)
</script>

<template>
  <section class="mt-10">
    <h2 class="mb-5 text-lg font-semibold">
      {{ t('catalog.comments') }}
      <span v-if="total" class="text-muted">({{ total }})</span>
    </h2>

    <div v-if="me" class="mb-6">
      <UTextarea
        v-model="draft"
        :rows="3"
        :maxlength="MAX"
        :placeholder="t('catalog.commentPlaceholder')"
        class="w-full"
      />
      <div class="mt-2 flex justify-end">
        <UButton
          size="sm"
          color="neutral"
          class="rounded-xl"
          :disabled="!draft.trim()"
          :loading="busy === 'root'"
          :label="t('catalog.comment')"
          @click="send(draft, null)"
        />
      </div>
    </div>

    <p v-else class="mb-6 text-sm text-muted">
      <NuxtLink :to="localePath('/login')" class="text-primary hover:underline">
        {{ t('catalog.signInToComment') }}
      </NuxtLink>
    </p>

    <UAlert v-if="error" color="error" variant="subtle" :description="error" class="mb-4" />

    <ul v-if="comments.length" class="space-y-5">
      <li v-for="comment in comments" :key="comment.id">
        <article class="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <header class="flex flex-wrap items-center gap-2 text-sm">
            <NuxtLink
              v-if="comment.author.username"
              :to="localePath(`/u/${comment.author.username}`)"
              class="font-medium hover:underline"
            >
              {{ comment.author.name || comment.author.username }}
            </NuxtLink>
            <span v-else class="font-medium">{{ comment.author.name }}</span>
            <span class="text-xs text-dimmed">{{ when(comment.created) }}</span>
            <UBadge v-if="comment.hidden" size="sm" color="error" variant="subtle" :label="t('catalog.hidden')" />
            <span class="flex-1"></span>
            <ProjectReportButton v-if="comment.author.id !== me?.id" item-type="comment" :item-id="comment.id" />
            <UButton
              v-if="canRemove(comment)"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-pixelarticons-trash"
              :loading="busy === comment.id"
              :aria-label="t('catalog.deleteComment')"
              @click="remove(comment.id)"
            />
          </header>

          <p class="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{{ comment.body }}</p>

          <UButton
            v-if="me"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-pixelarticons-reply"
            class="mt-2"
            :label="t('catalog.reply')"
            @click="replyTo = replyTo === comment.id ? null : comment.id"
          />

          <div v-if="replyTo === comment.id" class="mt-3">
            <UTextarea v-model="replyDraft" :rows="2" :maxlength="MAX" class="w-full" />
            <div class="mt-2 flex justify-end gap-2">
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                :label="t('catalog.cancel')"
                @click="replyTo = null; replyDraft = ''"
              />
              <UButton
                size="xs"
                color="neutral"
                :disabled="!replyDraft.trim()"
                :loading="busy === comment.id"
                :label="t('catalog.comment')"
                @click="send(replyDraft, comment.id)"
              />
            </div>
          </div>
        </article>

        <ul v-if="comment.replies.length" class="mt-3 space-y-3 border-l border-white/10 pl-5">
          <li
            v-for="reply in comment.replies"
            :key="reply.id"
            class="rounded-xl border border-white/10 bg-white/[0.02] p-3"
          >
            <header class="flex flex-wrap items-center gap-2 text-sm">
              <NuxtLink
                v-if="reply.author.username"
                :to="localePath(`/u/${reply.author.username}`)"
                class="font-medium hover:underline"
              >
                {{ reply.author.name || reply.author.username }}
              </NuxtLink>
              <span v-else class="font-medium">{{ reply.author.name }}</span>
              <span class="text-xs text-dimmed">{{ when(reply.created) }}</span>
              <UBadge v-if="reply.hidden" size="sm" color="error" variant="subtle" :label="t('catalog.hidden')" />
              <span class="flex-1"></span>
              <UButton
                v-if="canRemove(reply)"
                size="xs"
                variant="ghost"
                color="error"
                icon="i-pixelarticons-trash"
                :loading="busy === reply.id"
                :aria-label="t('catalog.deleteComment')"
                @click="remove(reply.id)"
              />
            </header>
            <p class="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{{ reply.body }}</p>
          </li>
        </ul>
      </li>
    </ul>

    <p v-else-if="loaded" class="text-sm text-dimmed">{{ t('catalog.noComments') }}</p>
  </section>
</template>
