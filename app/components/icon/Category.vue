<script setup lang="ts">
const props = defineProps<{ name: string }>()

// Registry: category id -> icon, one entry per value in CATEGORIES
// (shared/utils/catalog-types.ts). Adding a category there means adding a line
// here; an unmapped one falls back to the tag, so nothing renders blank.
//
// These are pixelarticons because that is the set the whole site draws from.
// Swapping in another set — Modrinth ships its own category marks — is a
// rewrite of this map and nothing else.
const ICONS: Record<string, string> = {
  // mod
  'adventure': 'compass',
  'cursed': 'alien',
  'decoration': 'colors-swatch',
  'economy': 'coin',
  'equipment': 'shield',
  'food': 'cake',
  'game-mechanics': 'dice',
  'library': 'book-open',
  'magic': 'wand',
  'management': 'sliders',
  'minigame': 'gamepad',
  'mobs': 'dog',
  'optimization': 'speed-fast',
  'social': 'users',
  'storage': 'archive',
  'technology': 'cpu',
  'transportation': 'bus',
  'utility': 'tools',

  // modpack
  'challenging': 'bullseye',
  'combat': 'sword',
  'kitchen-sink': 'card-stack',
  'lightweight': 'feather',
  'multiplayer': 'users',
  'quests': 'checklist',

  // resourcepack
  'audio': 'volume-3',
  'blocks': 'blocks',
  'entities': 'avatar',
  'environment': 'earth',
  'fonts': 'art-text',
  'gui': 'layout',
  'items': 'box',
  'locale': 'languages',
  'models': 'shapes',
  'realistic': 'camera',
  'simplistic': 'circle',
  'themed': 'paint-bucket',
  'tweaks': 'sliders-horizontal',
  'vanilla-like': 'leaf',

  // shader
  'atmosphere': 'cloud',
  'bloom': 'sparkle',
  'cartoon': 'brush',
  'colored-lighting': 'lightbulb-on',
  'fantasy': 'castle',
  'foliage': 'tree-pine',
  'path-tracing': 'zap',
  'pbr': 'drop',
  'performance': 'speed-fast',
  'reflections': 'image',
  'semi-realistic': 'camera',
  'shadows': 'moon',

  // schematic
  'base': 'flag',
  'farm': 'tree',
  'house': 'home',
  'interior': 'bed',
  'landscape': 'map',
  'medieval': 'castle',
  'modern': 'building-skyscraper',
  'redstone': 'circuit-board',
  'ship': 'anchor',
  'statue': 'avatar',
  'tower': 'buildings',
  'transport': 'bus',

  // plugin
  'admin-tools': 'tool-case',
  'anti-grief': 'lock',
  'chat': 'chat',
  'moderation': 'eye',
  'permissions': 'key',
  'protection': 'shield',
  'teleportation': 'move',
  'world-management': 'earth',
  'worldgen': 'map',
}

const icon = computed(() => `i-pixelarticons-${ICONS[props.name] ?? 'label'}`)
</script>

<template>
  <UIcon :name="icon" class="size-3.5 shrink-0" />
</template>
