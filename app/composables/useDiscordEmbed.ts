
import type { EmbedDraft } from '~/components/DiscordEmbedBuilder.vue'
import type { RowDraft } from '~/components/DiscordComponentsBuilder.vue'

export const DEFAULT_EMBED_COLOR = '#5865f2'

export function emptyEmbed(): EmbedDraft {
  return {
    title: '',
    description: '',
    url: '',
    color: DEFAULT_EMBED_COLOR,
    author: { name: '', url: '', icon_url: '' },
    footer: { text: '', icon_url: '' },
    image: { url: '' },
    thumbnail: { url: '' },
    fields: [],
    timestamp: false,
  }
}

export function embedToDraft(raw: unknown): EmbedDraft {
  const api = (raw ?? {}) as Record<string, any>
  const draft = emptyEmbed()

  draft.title = api.title ?? ''
  draft.description = api.description ?? ''
  draft.url = api.url ?? ''
  if (typeof api.color === 'number') {
    draft.color = `#${api.color.toString(16).padStart(6, '0')}`
  }

  if (api.author) {
    draft.author = {
      name: api.author.name ?? '',
      url: api.author.url ?? '',
      icon_url: api.author.icon_url ?? '',
    }
  }
  if (api.footer) {
    draft.footer = { text: api.footer.text ?? '', icon_url: api.footer.icon_url ?? '' }
  }
  draft.image = { url: api.image?.url ?? (typeof api.image === 'string' ? api.image : '') }
  draft.thumbnail = { url: api.thumbnail?.url ?? (typeof api.thumbnail === 'string' ? api.thumbnail : '') }

  if (Array.isArray(api.fields)) {
    draft.fields = api.fields.map((f: any) => ({
      name: f?.name ?? '',
      value: f?.value ?? '',
      inline: !!f?.inline,
    }))
  }

  draft.timestamp = !!api.timestamp
  return draft
}

export function componentsToDraft(raw: unknown): RowDraft[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((row: any) => Array.isArray(row?.components))
    .map((row: any) => ({
      type: 1 as const,
      components: row.components.map((c: any) => ({
        type: c.type,
        ...(c.style !== undefined ? { style: c.style } : {}),
        ...(c.label !== undefined ? { label: c.label } : {}),
        ...(c.custom_id !== undefined ? { custom_id: c.custom_id } : {}),
        ...(c.url !== undefined ? { url: c.url } : {}),
        ...(c.placeholder !== undefined ? { placeholder: c.placeholder } : {}),
        ...(Array.isArray(c.options)
          ? {
              options: c.options.map((o: any) => ({
                label: o?.label ?? '',
                value: o?.value ?? '',
                ...(o?.description ? { description: o.description } : {}),
              })),
            }
          : {}),
      })),
    }))
}
