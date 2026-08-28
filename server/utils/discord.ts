
import { q } from './db'

const API = 'https://discord.com/api/v10'
const CACHE_TTL = 5 * 60 * 1000

export interface DiscordConfig {
  token: string
  guildId: string
}

export function useDiscord(): DiscordConfig | null {
  const token = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID
  if (!token || !guildId) return null
  return { token, guildId }
}

export function requireDiscord(): DiscordConfig {
  const cfg = useDiscord()
  if (!cfg) throw createError({ statusCode: 501, statusMessage: 'Discord is not configured' })
  return cfg
}

const cache = new Map<string, { data: unknown, at: number }>()

export function clearDiscordCache() {
  cache.clear()
}

async function cached<T>(key: string, load: () => Promise<T>, ttl = CACHE_TTL): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.data as T
  const data = await load()
  cache.set(key, { data, at: Date.now() })
  return data
}

export async function discordRequest<T = unknown>(
  cfg: DiscordConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bot ${cfg.token}`,
      'content-type': 'application/json',
      'x-audit-log-reason': encodeURIComponent('Spectra admin panel'),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.json().catch(() => null) as { message?: string, retry_after?: number } | null
    const message = res.status === 429 && detail?.retry_after
      ? `Discord rate limit — retry in ${Math.ceil(detail.retry_after)}s`
      : detail?.message || `Discord API error ${res.status}`
    throw createError({ statusCode: res.status, statusMessage: message })
  }

  return (res.status === 204 ? null : await res.json()) as T
}

export interface DiscordChannel {
  id: string
  name: string
  type: number
  parent_id: string | null
  position: number
}

const POSTABLE_TYPES = new Set([0, 5, 10, 11, 12])

export function guildChannels(cfg: DiscordConfig) {
  return cached(`channels:${cfg.guildId}`, () =>
    discordRequest<DiscordChannel[]>(cfg, 'GET', `/guilds/${cfg.guildId}/channels`))
}

export async function postableChannels(cfg: DiscordConfig) {
  const all = await guildChannels(cfg)
  const categories = new Map(all.filter(c => c.type === 4).map(c => [c.id, c.name]))
  return all
    .filter(c => POSTABLE_TYPES.has(c.type))
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      id: c.id,
      name: c.name,
      category: c.parent_id ? categories.get(c.parent_id) ?? null : null,
    }))
}

export function botUser(cfg: DiscordConfig) {
  return cached(
    'me',
    () => discordRequest<{ id: string, username: string }>(cfg, 'GET', '/users/@me'),
    Infinity,
  )
}

export interface DiscordEmoji {
  id: string
  name: string
  animated: boolean
  available: boolean
  managed: boolean
}

export async function guildEmojis(cfg: DiscordConfig) {
  const emojis = await cached(`emojis:${cfg.guildId}`, () =>
    discordRequest<DiscordEmoji[]>(cfg, 'GET', `/guilds/${cfg.guildId}/emojis`))
  return emojis
    .filter(e => e.available !== false && e.id)
    .map(e => ({
      id: e.id,
      name: e.name,
      animated: !!e.animated,
      markup: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`,
    }))
}

export interface DiscordRole {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
}

export async function assignableRoles(cfg: DiscordConfig) {
  const roles = await cached(`roles:${cfg.guildId}`, () =>
    discordRequest<DiscordRole[]>(cfg, 'GET', `/guilds/${cfg.guildId}/roles`))
  return roles
    .filter(r => !r.managed && r.id !== cfg.guildId)
    .sort((a, b) => b.position - a.position)
    .map(r => ({ id: r.id, name: r.name, color: r.color }))
}

export const isSnowflake = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{17,20}$/.test(v)

export function requireSnowflake(value: unknown, field: string): string {
  if (!isSnowflake(value)) {
    throw createError({ statusCode: 400, statusMessage: `${field} must be a Discord id` })
  }
  return value
}

export async function spectraAccountsFor(discordIds: string[]) {
  if (!discordIds.length) return new Map<string, SpectraLink>()

  const rows = await q<SpectraLink & { discordId: string }>(
    `SELECT a."accountId" AS "discordId", u.id, u.username, u.name, u."mcUsername", u.banned
     FROM account a
     JOIN "user" u ON u.id = a."userId"
     WHERE a."providerId" = 'discord' AND a."accountId" = ANY($1)`,
    [discordIds],
  )
  return new Map(rows.map(r => [r.discordId, r]))
}

export interface SpectraLink {
  id: string
  username: string | null
  name: string | null
  mcUsername: string | null
  banned: boolean | null
}
