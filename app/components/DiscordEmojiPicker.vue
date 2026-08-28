<script setup lang="ts">

export interface GuildEmoji {
  id: string
  name: string
  animated: boolean
  markup: string
}

const props = defineProps<{
  emojis: GuildEmoji[]
  mode?: 'text' | 'button'
}>()

const emit = defineEmits<{ select: [GuildEmoji] }>()

const open = ref(false)
const search = ref('')

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return props.emojis
  return props.emojis.filter(e => e.name.toLowerCase().includes(query))
})

const url = (emoji: GuildEmoji) =>
  `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=44`

function choose(emoji: GuildEmoji) {
  if (props.mode !== 'button') insertAtCaret(emoji.markup)
  emit('select', emoji)
  search.value = ''
}
</script>

<template>
  <div class="relative">
    <UButton
      size="xs" color="neutral" variant="soft" icon="i-lucide-smile"
      :title="emojis.length ? 'Server emoji' : 'This server has no custom emoji'"
      :disabled="!emojis.length"
      @mousedown.prevent
      @click="open = !open"
    />

    <div
      v-if="open"
      class="absolute z-20 mt-1 w-72 rounded-lg border border-white/10 bg-[#1e1f22] p-2 shadow-xl"
      @mousedown.prevent
    >
      <div class="mb-2 flex items-center gap-1.5">
        <UInput v-model="search" size="xs" placeholder="Search…" class="flex-1" autofocus />
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="open = false" />
      </div>

      <p v-if="!filtered.length" class="px-1 py-3 text-center text-xs text-white/40">
        Nothing matches.
      </p>

      <div v-else class="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
        <button
          v-for="emoji in filtered" :key="emoji.id"
          type="button"
          class="flex size-8 items-center justify-center rounded transition hover:bg-white/10"
          :title="`:${emoji.name}:`"
          @mousedown.prevent
          @click="choose(emoji)"
        >
          <img :src="url(emoji)" :alt="emoji.name" class="size-6 object-contain" loading="lazy">
        </button>
      </div>

      <p v-if="mode !== 'button'" class="mt-2 px-1 text-[10px] text-white/30">
        Inserted where the cursor is. Click into a field first.
      </p>
    </div>
  </div>
</template>
