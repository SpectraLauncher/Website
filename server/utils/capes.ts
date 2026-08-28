export const CAPE_SOURCES = ['optifine', 'labymod', 'minecraftcapes'] as const
export type ModCapeSource = typeof CAPE_SOURCES[number]

export const isModCapeSource = (v: string): v is ModCapeSource =>
  (CAPE_SOURCES as readonly string[]).includes(v)

export const dashed = (uuid: string) => {
  const raw = uuid.replace(/-/g, '')
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
}

const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47]

export const isPng = (buffer: ArrayBuffer) => {
  if (buffer.byteLength < 8) return false
  const head = new Uint8Array(buffer, 0, 4)
  return PNG_MAGIC.every((byte, i) => head[i] === byte)
}

const grab = async (url: string) => {
  const buffer = await $fetch<ArrayBuffer>(url, {
    responseType: 'arrayBuffer',
    timeout: 7000,
    retry: 0
  }).catch(() => null)

  return buffer && isPng(buffer) ? buffer : null
}

export async function fetchModCape(
  source: ModCapeSource,
  name: string,
  uuid: string
): Promise<ArrayBuffer | null> {
  if (source === 'optifine') {
    return grab(`http://s.optifine.net/capes/${encodeURIComponent(name)}.png`)
  }

  if (source === 'labymod') {
    return grab(`https://dl.labymod.net/capes/${dashed(uuid)}`)
  }

  const profile = await $fetch<{ cape_url?: string | null }>(
    `https://api.minecraftcapes.net/profile/${uuid.replace(/-/g, '')}`,
    { timeout: 7000, retry: 0 }
  ).catch(() => null)

  return profile?.cape_url ? grab(profile.cape_url) : null
}

export const cachedModCape = defineCachedFunction(
  async (source: ModCapeSource, name: string, uuid: string) => {
    const image = await fetchModCape(source, name, uuid).catch(() => null)
    return image ? Buffer.from(image).toString('base64') : ''
  },
  {
    name: 'mc-cape-bytes',
    maxAge: 60 * 60 * 6,
    getKey: (source: ModCapeSource, _name: string, uuid: string) =>
      `${source}:${uuid.replace(/-/g, '').toLowerCase()}`
  }
)

export interface OwnedCape {
  slug: string
  name: string
  hash: string
}

interface CraftyCape { slug?: string, name?: string, hash?: string }

export async function fetchOwnedCapes(uuid: string): Promise<OwnedCape[]> {
  const data = await $fetch<{ data?: { capes?: CraftyCape[] } }>(
    `https://api.crafty.gg/api/v2/players/${uuid.replace(/-/g, '')}`,
    {
      timeout: 8000,
      retry: 0,
      headers: { accept: 'application/json', 'user-agent': 'SpectraTools (+https://spectra.makoto.com.pl)' }
    }
  ).catch(() => null)

  const capes = data?.data?.capes
  if (!Array.isArray(capes)) return []

  const seen = new Set<string>()

  return capes
    .filter((cape): cape is Required<CraftyCape> =>
      Boolean(cape?.hash && /^[0-9a-f]{16,128}$/i.test(cape.hash) && cape.name))
    .filter((cape) => {
      if (seen.has(cape.hash)) return false
      seen.add(cape.hash)
      return true
    })
    .map(cape => ({ slug: cape.slug || cape.hash.slice(0, 8), name: cape.name, hash: cape.hash }))
}

export const cachedOwnedCapes = defineCachedFunction(fetchOwnedCapes, {
  name: 'mc-owned-capes',
  maxAge: 60 * 60 * 6,
  getKey: (uuid: string) => uuid.replace(/-/g, '').toLowerCase()
})
