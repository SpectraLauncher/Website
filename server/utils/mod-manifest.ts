
import { type TomlTable, parseManifest, parseToml } from './toml'
import { type Zip, openZip } from './zip'
import { parseYaml, yamlList, yamlString } from './yaml'

export type Loader =
  | 'fabric' | 'quilt' | 'forge' | 'neoforge'
  | 'bukkit' | 'spigot' | 'paper' | 'purpur' | 'folia'
  | 'sponge' | 'bungeecord' | 'velocity' | 'waterfall'
export type PackKind =
  | 'mod' | 'plugin' | 'modpack' | 'resourcepack' | 'shader' | 'datapack' | 'unknown'

export interface ModInfo {
  kind: PackKind
  loaders: Loader[]
  modId: string | null
  name: string | null
  version: string | null
  description: string | null
  authors: string[]
  license: string | null
  links: Record<string, string>
  environment: 'client' | 'server' | 'both' | null
  // Manifests give a range ("~1.20.1", ">=26.1"), not a list of versions.
  // Expanding a range into concrete versions needs a list of every Minecraft
  // release, which we do not have — so the range goes to the interface as a hint
  // and a human picks the versions. Guessing here would be worse than an empty
  // field.
  gameVersionRange: string | null
  packFormat: number | null
  shaderEngines: string[]
  packFiles: PackFile[]
}

export interface PackFile {
  path: string
  size: number
  hashes: { sha1: string, sha512: string }
  downloads: string[]
  env: { client?: string, server?: string } | null
}

function empty(kind: PackKind): ModInfo {
  return {
    kind,
    loaders: [],
    modId: null,
    name: null,
    version: null,
    description: null,
    authors: [],
    license: null,
    links: {},
    environment: null,
    gameVersionRange: null,
    packFormat: null,
    shaderEngines: [],
    packFiles: [],
  }
}

interface MrpackIndex {
  formatVersion?: number
  name?: string
  summary?: string
  versionId?: string
  dependencies?: Record<string, string>
  files?: Array<{
    path?: string
    fileSize?: number
    hashes?: { sha1?: string, sha512?: string }
    downloads?: string[]
    env?: { client?: string, server?: string }
  }>
}

// The loader is whichever loader key the index declares alongside minecraft.
const MRPACK_LOADERS: Record<string, Loader> = {
  'fabric-loader': 'fabric',
  'quilt-loader': 'quilt',
  'forge': 'forge',
  'neoforge': 'neoforge',
}

function fromMrpack(index: MrpackIndex): ModInfo {
  const info = empty('modpack')
  const dependencies = index.dependencies ?? {}

  info.name = str(index.name)
  info.version = str(index.versionId)
  info.description = str(index.summary)
  info.gameVersionRange = str(dependencies.minecraft)

  for (const [key, loader] of Object.entries(MRPACK_LOADERS)) {
    if (dependencies[key]) info.loaders = [loader]
  }

  info.packFiles = (index.files ?? [])
    .filter(file => typeof file.path === 'string' && file.hashes?.sha512)
    .map(file => ({
      path: file.path!,
      size: Number(file.fileSize) || 0,
      hashes: { sha1: String(file.hashes?.sha1 ?? ''), sha512: String(file.hashes!.sha512) },
      downloads: (file.downloads ?? []).filter(url => typeof url === 'string'),
      env: file.env ?? null,
    }))

  return info
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

const asAuthors = (v: unknown): string[] => {
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean)
  if (Array.isArray(v)) {
    return v.flatMap((entry) => {
      if (typeof entry === 'string') return [entry.trim()]
      const name = (entry as Record<string, unknown>)?.name
      return typeof name === 'string' ? [name.trim()] : []
    }).filter(Boolean)
  }
  return []
}

function fabricLike(json: Record<string, any>, loader: Loader): ModInfo {
  const info = empty('mod')
  const body = loader === 'quilt' ? (json.quilt_loader ?? json) : json
  const meta = loader === 'quilt' ? (body.metadata ?? {}) : body

  info.loaders = [loader]
  info.modId = str(body.id)
  info.name = str(meta.name)
  info.version = str(body.version)
  info.description = str(meta.description)
  info.authors = asAuthors(meta.authors ?? meta.contributors)
  info.license = str(meta.license ?? json.license)

  const contact = meta.contact ?? meta.contact_information ?? {}
  for (const [key, value] of Object.entries(contact)) {
    if (typeof value === 'string') info.links[key] = value
  }

  const env = str(json.environment)
  info.environment = env === 'client' ? 'client' : env === 'server' ? 'server' : 'both'

  const depends = body.depends ?? json.depends
  const mc = Array.isArray(depends)
    ? depends.find((d: any) => d?.id === 'minecraft')?.versions
    : depends?.minecraft
  info.gameVersionRange = Array.isArray(mc) ? str(mc[0]) : str(mc)

  return info
}

function forgeLike(toml: TomlTable, loader: Loader, manifest: Record<string, string>): ModInfo {
  const info = empty('mod')
  const mods = Array.isArray(toml.mods) ? toml.mods as TomlTable[] : []
  const mod = mods[0] ?? {}

  info.loaders = [loader]
  info.modId = str(mod.modId)
  info.name = str(mod.displayName)
  info.description = str(mod.description)
  info.authors = asAuthors(mod.authors)
  info.license = str(toml.license ?? mod.license)

  const url = str(mod.displayURL)
  if (url) info.links.homepage = url
  const issues = str(toml.issueTrackerURL)
  if (issues) info.links.issues = issues

  // `${file.jarVersion}` is a placeholder Forge substitutes from the manifest
  // only at load time — without this the version would read literally like that.
  const declared = str(mod.version)
  info.version = !declared || declared.includes('${')
    ? str(manifest['Implementation-Version'])
    : declared

  const deps = (toml.dependencies as TomlTable | undefined)?.[info.modId ?? '']
  if (Array.isArray(deps)) {
    const mc = (deps as TomlTable[]).find(d => d.modId === 'minecraft')
    info.gameVersionRange = str(mc?.versionRange)
  }

  return info
}

// A plugin descriptor names the platform it was written for, and the platforms
// are a family tree: Purpur forks Paper, Paper forks Spigot, Spigot forks
// Bukkit, and Waterfall forks BungeeCord. A jar built for the parent runs on the
// forks, which is why one descriptor yields several loaders.
//
// Registry: descriptor inside the archive -> the platforms it runs on. Order
// matters, because a proxy plugin may also carry a plugin.yml.
const PLUGIN_MANIFESTS: Array<{ entry: string, loaders: Loader[], format: 'yaml' | 'json' }> = [
  { entry: 'velocity-plugin.json', loaders: ['velocity'], format: 'json' },
  { entry: 'bungee.yml', loaders: ['bungeecord', 'waterfall'], format: 'yaml' },
  { entry: 'META-INF/sponge_plugins.json', loaders: ['sponge'], format: 'json' },
  { entry: 'paper-plugin.yml', loaders: ['paper', 'purpur'], format: 'yaml' },
  { entry: 'plugin.yml', loaders: ['bukkit', 'spigot', 'paper', 'purpur'], format: 'yaml' },
]

function fromPluginYaml(zip: Zip, entry: string, loaders: Loader[]): ModInfo {
  const info = empty('plugin')
  const doc = parseYaml(zip.readText(entry) ?? '')

  info.loaders = [...loaders]
  info.modId = yamlString(doc.name)
  info.name = yamlString(doc.name)
  info.version = yamlString(doc.version)
  info.description = yamlString(doc.description)
  info.authors = yamlList(doc.authors ?? doc.author)
  info.gameVersionRange = yamlString(doc['api-version'])
  info.environment = 'server'

  const website = yamlString(doc.website)
  if (website) info.links.homepage = website

  // Folia runs plugins on several region threads at once, so it only accepts a
  // plugin that says it was written for that.
  if (doc['folia-supported'] === true) info.loaders.push('folia')

  return info
}

function fromPluginJson(zip: Zip, entry: string, loaders: Loader[]): ModInfo {
  const info = empty('plugin')
  const doc = zip.readJson<Record<string, any>>(entry) ?? {}
  const body = Array.isArray(doc.plugins) ? (doc.plugins[0] ?? {}) : doc

  info.loaders = [...loaders]
  info.modId = str(body.id)
  info.name = str(body.name) ?? str(body.id)
  info.version = str(body.version)
  info.description = str(body.description)
  info.authors = asAuthors(body.authors ?? body.contributors)
  info.environment = 'server'

  const url = str(body.url) ?? str(body.links?.homepage)
  if (url) info.links.homepage = url

  return info
}

// Registry: file inside the archive -> loader. Order matters, because NeoForge
// also leaves the old mods.toml in the jar — the first match wins. Adding a
// loader is one line here and one branch in readArchiveInfo.
const MANIFESTS: Array<{ entry: string, loader: Loader }> = [
  { entry: 'fabric.mod.json', loader: 'fabric' },
  { entry: 'quilt.mod.json', loader: 'quilt' },
  { entry: 'META-INF/neoforge.mods.toml', loader: 'neoforge' },
  { entry: 'META-INF/mods.toml', loader: 'forge' },
]

interface PackMeta { packFormat: number | null, description: string | null }

function readPackMeta(zip: Zip): PackMeta {
  const meta = zip.readJson<{ pack?: { pack_format?: number, description?: unknown } }>('pack.mcmeta')
  const pack = meta?.pack
  if (!pack) return { packFormat: null, description: null }

  // The description is sometimes a raw text component rather than a string.
  const description = typeof pack.description === 'string'
    ? pack.description
    : str((pack.description as { text?: string } | undefined)?.text)

  return {
    packFormat: typeof pack.pack_format === 'number' ? pack.pack_format : null,
    description: description ?? null,
  }
}

// Shaderpacks have no manifest. The engine is recognised by what the archive
// contains: a shaders/ directory is the necessary condition, and the .properties
// files inside separate OptiFine/Iris from Canvas.
function shaderEngines(zip: Zip): string[] {
  const names = zip.entries.map(e => e.name)
  const inShaders = names.filter(n => n.startsWith('shaders/'))
  if (!inShaders.length) return []

  const engines = new Set<string>()
  if (inShaders.some(n => n.endsWith('.properties') || n.endsWith('.fsh') || n.endsWith('.vsh'))) {
    engines.add('optifine')
    engines.add('iris')
  }
  if (names.some(n => n.startsWith('pipelines/') || n.endsWith('.json5'))) engines.add('canvas')

  return [...engines].sort()
}

export function readArchiveInfo(body: Uint8Array): ModInfo {
  const zip = openZip(body)

  if (zip.has('modrinth.index.json')) {
    return fromMrpack(zip.readJson<MrpackIndex>('modrinth.index.json') ?? {})
  }

  for (const { entry, loader } of MANIFESTS) {
    if (!zip.has(entry)) continue

    const manifest = parseManifest(zip.readText('META-INF/MANIFEST.MF') ?? '')
    const info = loader === 'fabric' || loader === 'quilt'
      ? fabricLike(zip.readJson<Record<string, any>>(entry) ?? {}, loader)
      : forgeLike(parseToml(zip.readText(entry) ?? ''), loader, manifest)

    info.packFormat = readPackMeta(zip).packFormat
    if (!info.version) info.version = str(manifest['Implementation-Version'])
    return info
  }

  for (const { entry, loaders, format } of PLUGIN_MANIFESTS) {
    if (!zip.has(entry)) continue
    return format === 'yaml'
      ? fromPluginYaml(zip, entry, loaders)
      : fromPluginJson(zip, entry, loaders)
  }

  const engines = shaderEngines(zip)
  if (engines.length) {
    const info = empty('shader')
    info.shaderEngines = engines
    info.name = str(zip.readText('shaders/shaders.properties')?.match(/^#\s*(.+)$/m)?.[1])
    return info
  }

  const pack = readPackMeta(zip)
  if (pack.packFormat !== null) {
    const hasAssets = zip.entries.some(e => e.name.startsWith('assets/'))
    const info = empty(hasAssets ? 'resourcepack' : 'datapack')
    info.packFormat = pack.packFormat
    info.description = pack.description
    return info
  }

  return empty('unknown')
}
