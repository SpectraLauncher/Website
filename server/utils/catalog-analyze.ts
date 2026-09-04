
import { normalizeSlug } from './catalog-slug'
import type { ProjectType } from './catalog-types'
import { expandRange, minecraftVersions, releaseIds } from './game-versions'
import { type ModInfo, readArchiveInfo } from './mod-manifest'
import { type SchematicInfo, parseSchematic } from './schematic'

export interface UploadAnalysis {
  detected: ProjectType | null
  title: string | null
  slug: string | null
  summary: string | null
  version: string | null
  license: string | null
  links: Record<string, string>
  loaders: string[]
  gameVersionRange: string | null
  gameVersions: string[]
  meta: Record<string, unknown>
  warnings: string[]
}

function blank(): UploadAnalysis {
  return {
    detected: null,
    title: null,
    slug: null,
    summary: null,
    version: null,
    license: null,
    links: {},
    loaders: [],
    gameVersionRange: null,
    gameVersions: [],
    meta: {},
    warnings: [],
  }
}

function fromArchive(info: ModInfo, releases: string[]): UploadAnalysis {
  const out = blank()

  out.title = info.name
  out.slug = info.name ? normalizeSlug(info.name) : null
  out.summary = info.description?.slice(0, 400) ?? null
  out.version = info.version
  out.license = info.license
  out.links = info.links
  out.gameVersionRange = info.gameVersionRange
  out.gameVersions = expandRange(info.gameVersionRange, releases)

  if (info.kind === 'mod') {
    out.detected = 'mod'
    out.loaders = info.loaders
    out.meta = { modId: info.modId, environment: info.environment }
    // Quilt loads Fabric mods unchanged, so a Fabric jar is usable on both and
    // saying so is a fact about the loader, not a guess about the mod.
    if (info.loaders.includes('fabric')) out.loaders = ['fabric', 'quilt']
  }

  if (info.kind === 'shader') {
    out.detected = 'shader'
    out.loaders = info.shaderEngines
    out.meta = { engines: info.shaderEngines }
  }

  if (info.kind === 'resourcepack') {
    out.detected = 'resourcepack'
    out.loaders = ['minecraft']
    out.meta = { packFormat: info.packFormat }
    out.summary ??= info.description
  }

  if (info.kind === 'datapack') {
    out.detected = null
    out.warnings.push('this looks like a datapack, which the catalog does not carry yet')
  }

  if (!out.gameVersions.length && out.gameVersionRange) {
    out.warnings.push(`could not resolve the declared range "${out.gameVersionRange}" `
      + 'into known releases — pick the versions by hand')
  }
  if (!out.gameVersionRange && out.detected === 'mod') {
    out.warnings.push('the manifest declares no Minecraft dependency, so no versions '
      + 'could be derived from it')
  }

  return out
}

function fromSchematic(info: SchematicInfo): UploadAnalysis {
  const out = blank()

  out.detected = 'schematic'
  out.title = info.name
  out.slug = info.name ? normalizeSlug(info.name) : null
  out.loaders = [info.format]
  out.meta = {
    format: info.format,
    dataVersion: info.dataVersion,
    size: info.size,
    volume: info.volume,
    blockCount: info.blockCount,
    materials: info.materials,
    palette: info.palette,
    requiredMods: info.requiredMods,
  }

  if (info.requiredMods.length) {
    out.warnings.push(`uses blocks from outside vanilla: ${info.requiredMods.join(', ')}`)
  }
  if (info.unknown.length) {
    out.warnings.push(`${info.unknown.length} legacy block id(s) could not be named, `
      + 'so the material list is incomplete')
  }

  return out
}

// Content decides what a file is, never the extension. A .zip holding a
// fabric.mod.json is a mod; a .nbt is only a schematic if it parses as one.
export async function analyzeUpload(body: Uint8Array, filename: string): Promise<UploadAnalysis> {
  const releases = releaseIds(await minecraftVersions().catch(() => []))

  try {
    return fromArchive(readArchiveInfo(body), releases)
  } catch {
    // not a readable archive, fall through to the schematic reader
  }

  try {
    return fromSchematic(parseSchematic(body))
  } catch (e) {
    const out = blank()
    out.warnings.push(`could not read ${filename}: ${(e as Error).message}`)
    return out
  }
}
