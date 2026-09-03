
import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_NOTES = 3800

const SPECTRA_GREEN = 0x3fb877

function changelogOnly(body: string): string {
  const at = body.indexOf("What's Changed")
  if (at === -1) return body.trim()
  const eol = body.indexOf('\n', at)
  return eol === -1 ? '' : body.slice(eol + 1).trim()
}

interface ReleaseAsset {
  name?: string
  browser_download_url?: string
}

interface ReleasePayload {
  action?: string
  release?: {
    id?: number
    tag_name?: string
    name?: string
    body?: string
    html_url?: string
    draft?: boolean
    prerelease?: boolean
    published_at?: string
    assets?: ReleaseAsset[]
  }
}

const PLATFORMS: { label: string, emoji: string, match: (name: string) => boolean }[] = [
  { label: 'Windows', emoji: '🪟', match: n => n.endsWith('-setup.exe') },
  { label: 'macOS (M1+)', emoji: '🍎', match: n => n.endsWith('aarch64.dmg') },
  { label: 'macOS (Intel)', emoji: '🍎', match: n => n.endsWith('x64.dmg') },
  { label: 'Linux (AppImage)', emoji: '🐧', match: n => n.endsWith('.AppImage') },
  { label: 'Linux (deb)', emoji: '🐧', match: n => n.endsWith('.deb') },
]

function downloadButtons(assets: ReleaseAsset[], releaseUrl: string) {
  const buttons = PLATFORMS.flatMap((p) => {
    const hit = assets.find(a => a.name && a.browser_download_url && p.match(a.name))
    return hit
      ? [{ type: 2, style: 5, label: p.label, emoji: { name: p.emoji }, url: hit.browser_download_url! }]
      : []
  }).slice(0, 5)

  if (!buttons.length && releaseUrl) {
    return [{ type: 1, components: [{ type: 2, style: 5, label: 'Downloads', url: releaseUrl }] }]
  }
  return buttons.length ? [{ type: 1, components: buttons }] : []
}

export default defineEventHandler(async (event) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    throw createError({ statusCode: 501, statusMessage: 'GITHUB_WEBHOOK_SECRET is not set' })
  }

  const raw = await readRawBody(event, 'utf8')
  if (!raw) throw createError({ statusCode: 400, statusMessage: 'empty body' })

  const sent = Buffer.from(getHeader(event, 'x-hub-signature-256') ?? '')
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`)
  if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'bad signature' })
  }

  const payload = JSON.parse(raw) as ReleasePayload
  const release = payload.release
  if (payload.action !== 'published') return { ok: true, skipped: `action ${payload.action}` }
  if (!release?.id || release.draft || release.prerelease) {
    return { ok: true, skipped: 'draft or prerelease' }
  }

  const cfg = useDiscord()
  if (!cfg) return { ok: true, skipped: 'Discord is not configured' }

  const row = await one<{ release_channel: string | null, release_role: string | null }>(
    'SELECT release_channel, release_role FROM discord_config WHERE guild_id = $1',
    [cfg.guildId])
  const channelId = row?.release_channel
  if (!channelId) return { ok: true, skipped: 'no release channel set in the panel' }

  const tag = String(release.tag_name ?? '')

  const claimed = await exec(
    `INSERT INTO discord_releases (release_id, tag, posted) VALUES ($1, $2, $3)
     ON CONFLICT (release_id) DO NOTHING`,
    [String(release.id), tag, Date.now()])
  if (!claimed) return { ok: true, skipped: 'already announced' }

  const notes = changelogOnly(String(release.body ?? ''))
  const url = release.html_url ?? ''
  const version = tag.replace(/^v/, '')
  const site = process.env.NUXT_PUBLIC_SITE_URL || 'https://usespectra.app'
  const role = row?.release_role ?? null

  try {
    const sentMessage = await discordRequest<{ id: string }>(
      cfg, 'POST', `/channels/${channelId}/messages`, {
        embeds: [{
          author: { name: 'Spectra Launcher', url: site, icon_url: `${site}/logo.png` },
          title: `Version ${version} is out`,
          ...(url ? { url } : {}),
          description: notes.length > MAX_NOTES
            ? `${notes.slice(0, MAX_NOTES)}…\n\n[Read the rest on GitHub](${url})`
            : notes,
          color: SPECTRA_GREEN,
          thumbnail: { url: `${site}/logo-transparent.png` },
          ...(release.published_at ? { timestamp: release.published_at } : {}),
          footer: { text: 'Update from inside the launcher, or grab it below' },
        }],
        components: downloadButtons(release.assets ?? [], url),
        ...(role ? { content: `<@&${role}>` } : {}),
        allowed_mentions: role ? { roles: [role] } : { parse: [] },
      })
    return { ok: true, messageId: sentMessage.id }
  } catch (e) {
    await exec('DELETE FROM discord_releases WHERE release_id = $1', [String(release.id)])
    throw e
  }
})
