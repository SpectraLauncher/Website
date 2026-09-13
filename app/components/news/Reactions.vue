<script setup lang="ts">
interface State {
  counts: Record<string, number>
  mine: string[]
}

const props = defineProps<{ slug: string, reactions: State }>()

const { t } = useI18n()
const localePath = useLocalePath()
const session = useAuthSession()

const state = ref<State>({ counts: { ...props.reactions.counts }, mine: [...props.reactions.mine] })
const busy = ref('')

// Which button is mid-animation. Cleared on the animation's own end event, so
// the class lives exactly as long as the animation does.
const popping = ref('')

const signedIn = computed(() => Boolean(session.value.data?.user))
const mine = (id: string) => state.value.mine.includes(id)

async function pick(id: string) {
  if (!signedIn.value || busy.value) return

  const adding = !mine(id)
  busy.value = id

  // The button answers the click, not the round trip: a count that waits for the
  // server feels broken on a slow connection. The reply replaces it either way.
  state.value = {
    counts: { ...state.value.counts, [id]: (state.value.counts[id] ?? 0) + (adding ? 1 : -1) },
    mine: adding ? [...state.value.mine, id] : state.value.mine.filter(x => x !== id),
  }

  if (adding) popping.value = id

  try {
    const res = await $fetch<{ reactions: State }>(
      `/api/news/${encodeURIComponent(props.slug)}/reactions`,
      { method: 'POST', body: { kind: id } },
    )
    state.value = res.reactions
  }
  catch {
    // Put it back rather than leave a number nobody agreed to.
    state.value = {
      counts: { ...state.value.counts, [id]: (state.value.counts[id] ?? 0) + (adding ? -1 : 1) },
      mine: adding ? state.value.mine.filter(x => x !== id) : [...state.value.mine, id],
    }
  }
  finally { busy.value = '' }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      v-for="reaction in REACTIONS"
      :key="reaction.id"
      type="button"
      class="reaction"
      :class="{ 'is-mine': mine(reaction.id), 'is-popping': popping === reaction.id }"
      :style="{ '--tone': reaction.tone }"
      :disabled="!signedIn"
      :title="signedIn ? t(`reactions.${reaction.id}`) : t('reactions.signIn')"
      :aria-pressed="mine(reaction.id)"
      :aria-label="t(`reactions.${reaction.id}`)"
      @animationend="popping = ''"
      @click="pick(reaction.id)"
    >
      <UIcon :name="reaction.icon" class="reaction-icon size-4" />
      <span class="tabular-nums">{{ state.counts[reaction.id] ?? 0 }}</span>

      <!-- A second copy of the mark, drifting up and out. It is decoration, so
           it is hidden from anything reading the page aloud. -->
      <UIcon
        v-if="popping === reaction.id"
        :name="reaction.icon"
        class="reaction-spark size-4"
        aria-hidden="true"
      />
    </button>

    <NuxtLink
      v-if="!signedIn"
      :to="localePath('/auth/login')"
      class="ml-1 text-xs text-dimmed underline-offset-2 transition-colors hover:text-muted hover:underline"
    >
      {{ t('reactions.signIn') }}
    </NuxtLink>
  </div>
</template>

<style scoped>
.reaction {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--color-raised-line);
  border-radius: 999px;
  background: var(--color-raised);
  color: var(--ui-text-muted);
  font-size: 0.8125rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color .15s ease, color .15s ease, background .15s ease, transform .12s ease;
}

.reaction:hover:not(:disabled) {
  border-color: color-mix(in oklab, var(--tone) 45%, transparent);
  color: var(--ui-text);
}

.reaction:active:not(:disabled) { transform: scale(.94); }
.reaction:disabled { cursor: default; opacity: .6; }

.reaction.is-mine {
  border-color: color-mix(in oklab, var(--tone) 55%, transparent);
  background: color-mix(in oklab, var(--tone) 12%, transparent);
  color: var(--tone);
}

/* The press: the mark springs past its size and settles back. */
.reaction.is-popping .reaction-icon {
  animation: reaction-pop .45s cubic-bezier(.2, 1.6, .4, 1);
}

@keyframes reaction-pop {
  0% { transform: scale(1); }
  35% { transform: scale(1.55) rotate(-8deg); }
  100% { transform: scale(1); }
}

/* And a copy of it leaves. */
.reaction-spark {
  position: absolute;
  left: 0.7rem;
  top: 50%;
  color: var(--tone);
  pointer-events: none;
  animation: reaction-spark .6s ease-out forwards;
}

@keyframes reaction-spark {
  0% { opacity: .9; transform: translateY(-50%) scale(1); }
  100% { opacity: 0; transform: translateY(-220%) scale(1.5); }
}

@media (prefers-reduced-motion: reduce) {
  .reaction,
  .reaction.is-popping .reaction-icon { transition: none; animation: none; }
  .reaction-spark { display: none; }
}
</style>
