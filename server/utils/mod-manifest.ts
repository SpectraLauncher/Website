
import { type TomlTable, parseManifest, parseToml } from './toml'
import { type Zip, openZip } from './zip'

export type Loader = 'fabric' | 'quilt' | 'forge' | 'neoforge'
export type PackKind = 'mod' | 'resourcepack' | 'shader' | 'datapack' | 'unknown'

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
  // Manifesty podaja zakres ("~1.20.1", ">=26.1"), nie liste wersji. Rozwiniecie
  // zakresu w konkretne wersje wymaga listy wszystkich wydan Minecrafta, ktorej
  // nie mamy — wiec zakres idzie do interfejsu jako podpowiedz, a wersje wybiera
  // czlowiek. Zgadywanie tutaj byloby gorsze niz puste pole.
  gameVersionRange: string | null
  packFormat: number | null
  shaderEngines: string[]
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
  }
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

// --- fabric / quilt ------------------------------------------------------

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

// --- forge / neoforge ----------------------------------------------------

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

  // `${file.jarVersion}` to placeholder, ktory Forge podstawia z manifestu
  // dopiero przy ladowaniu — bez tego wersja wygladalaby doslownie tak.
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

// --- rejestr manifestow --------------------------------------------------

// Rejestr: plik w archiwum -> loader. Kolejnosc ma znaczenie, bo NeoForge
// zostawia w jarze rowniez stary mods.toml — pierwszy pasujacy wygrywa.
// Dodanie loadera to jedna linia tutaj i jedna galaz w readModInfo.
const MANIFESTS: Array<{ entry: string, loader: Loader }> = [
  { entry: 'fabric.mod.json', loader: 'fabric' },
  { entry: 'quilt.mod.json', loader: 'quilt' },
  { entry: 'META-INF/neoforge.mods.toml', loader: 'neoforge' },
  { entry: 'META-INF/mods.toml', loader: 'forge' },
]

// --- pack.mcmeta ---------------------------------------------------------

interface PackMeta { packFormat: number | null, description: string | null }

function readPackMeta(zip: Zip): PackMeta {
  const meta = zip.readJson<{ pack?: { pack_format?: number, description?: unknown } }>('pack.mcmeta')
  const pack = meta?.pack
  if (!pack) return { packFormat: null, description: null }

  // Opis bywa surowym komponentem tekstowym zamiast stringiem.
  const description = typeof pack.description === 'string'
    ? pack.description
    : str((pack.description as { text?: string } | undefined)?.text)

  return {
    packFormat: typeof pack.pack_format === 'number' ? pack.pack_format : null,
    description: description ?? null,
  }
}

// --- shadery -------------------------------------------------------------

// Shaderpacki nie maja manifestu. Silnik poznaje sie po tym, na co archiwum
// reaguje: katalog shaders/ to warunek konieczny, a pliki .properties wewnatrz
// odrozniaja OptiFine/Iris od Canvasa.
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

// --- wejscie -------------------------------------------------------------

export function readArchiveInfo(body: Uint8Array): ModInfo {
  const zip = openZip(body)

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
