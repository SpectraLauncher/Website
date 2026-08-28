const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

interface MojangProperty { name: string, value: string }
interface SessionProfile { id: string, name: string, properties?: MojangProperty[] }

interface TexturePayload {
  textures?: {
    SKIN?: { url?: string, metadata?: { model?: string } }
    CAPE?: { url?: string }
  }
}

export interface ResolvedProfile {
  uuid: string
  name: string
  skin: string | null
  model: 'classic' | 'slim'
  cape: string | null
}

const https = (url: string) => url.replace(/^http:\/\//, 'https://')

export const isValidLookup = (q: string) =>
  UUID_RE.test(q) || /^[A-Za-z0-9_]{1,16}$/.test(q)

async function fetchProfile(query: string): Promise<ResolvedProfile> {
  const q = query.trim()
  let uuid = q.replace(/-/g, '')

  if (!UUID_RE.test(q)) {
    const found = await $fetch<{ id: string }>(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(q)}`
    )
    if (!found?.id) throw new Error('unknown player')
    uuid = found.id
  }

  const profile = await $fetch<SessionProfile>(
    `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`
  )

  if (!profile?.id) throw new Error('unknown player')

  const encoded = profile.properties?.find(p => p.name === 'textures')?.value
  let payload: TexturePayload = {}

  if (encoded) {
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as TexturePayload
    }
    catch {
      payload = {}
    }
  }

  const skinUrl = payload.textures?.SKIN?.url
  const capeUrl = payload.textures?.CAPE?.url

  return {
    uuid: profile.id,
    name: profile.name,
    skin: skinUrl ? https(skinUrl) : null,
    model: payload.textures?.SKIN?.metadata?.model === 'slim' ? 'slim' : 'classic',
    cape: capeUrl ? https(capeUrl) : null
  }
}

const cachedProfile = defineCachedFunction(fetchProfile, {
  name: 'mojang-profile',
  maxAge: 60 * 30,
  getKey: (query: string) => `profile:${query.trim().toLowerCase().replace(/-/g, '')}`
})

export async function resolveProfile(query: string): Promise<ResolvedProfile | null> {
  const q = query.trim()
  if (!q || q.length > 36 || !isValidLookup(q)) return null
  return cachedProfile(q).catch(() => null)
}
