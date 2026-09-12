/**
 * The message a moderator composes in the Discord panel.
 *
 * Shaped after Discord's own payloads, so the field names are theirs — snake
 * case and all — and what the builder holds can be posted without translation.
 */

export interface EmbedField {
  name: string
  value: string
  inline: boolean
}

export interface EmbedDraft {
  title: string
  description: string
  url: string
  color: string
  author: { name: string, url: string, icon_url: string }
  footer: { text: string, icon_url: string }
  image: { url: string }
  thumbnail: { url: string }
  fields: EmbedField[]
  timestamp: boolean
}

export interface ComponentDraft {
  type: number
  style?: number
  label?: string
  custom_id?: string
  url?: string
  emoji?: { id?: string, name?: string, animated?: boolean }
  placeholder?: string
  options?: { label: string, value: string, description?: string }[]
}

/** An action row. Discord numbers it 1 and accepts nothing else at the top. */
export interface RowDraft {
  type: 1
  components: ComponentDraft[]
}

export interface GuildEmoji {
  id: string
  name: string
  animated: boolean
  markup: string
}
