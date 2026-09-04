
import { normalizeSlug } from './catalog-slug'
import type { ProjectType } from './catalog-types'
import { expandRange, minecraftVersions, releaseIds } from './game-versions'
import { type ModInfo, readArchiveInfo } from './mod-manifest'
import { type SchematicInfo, parseSchematic, schematicGrid } from './schematic'
import { previewDocument, previewKey, voxelize } from './schematic-voxels'
import { storeDerived } from './content-store'

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
  environment: string[]
  meta: Record<string, unknown>
  // Translation keys with parameters, not sentences — the client decides the
  // language, and the server has no idea which one that is.
  warnings: Array<{ code: string, params: Record<string, string> }>
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
    environment: [],
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
    out.environment = info.environment === 'client'
      ? ['client']
      : info.environment === 'server' ? ['server'] : ['client', 'server']
    out.meta = { modId: info.modId, environment: info.environment }
    // Quilt loads Fabric mods unchanged, so a Fabric jar is usable on both and
    // saying so is a fact about the loader, not a guess about the mod.
    if (info.loaders.includes('fabric')) out.loaders = ['fabric', 'quilt']
  }

  if (info.kind === 'shader') {
    out.detected = 'shader'
    out.loaders = info.shaderEngines
    out.environment = ['client']
    out.meta = { engines: info.shaderEngines }
  }

  if (info.kind === 'resourcepack') {
    out.detected = 'resourcepack'
    out.loaders = ['minecraft']
    out.environment = ['client']
    out.meta = { packFormat: info.packFormat }
    out.summary ??= info.description
  }

  if (info.kind === 'datapack') {
    out.detected = null
    out.warnings.push({ code: 'catalog.warn.datapack', params: {} })
  }

  if (!out.gameVersions.length && out.gameVersionRange) {
    out.warnings.push({
      code: 'catalog.warn.unresolvedRange',
      params: { range: out.gameVersionRange },
    })
  }
  if (!out.gameVersionRange && out.detected === 'mod') {
    out.warnings.push({ code: 'catalog.warn.noDependency', params: {} })
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
    out.warnings.push({
      code: 'catalog.warn.moddedBlocks',
      params: { mods: info.requiredMods.join(', ') },
    })
  }
  if (info.unknown.length) {
    out.warnings.push({
      code: 'catalog.warn.unknownLegacyIds',
      params: { n: String(info.unknown.length) },
    })
  }

  return out
}

// Content decides what a file is, never the extension. A .zip holding a
// fabric.mod.json is a mod; a .nbt is only a schematic if it parses as one.
export async function analyzeUpload(
  body: Uint8Array,
  filename: string,
  sha512?: string,
): Promise<UploadAnalysis> {
  const releases = releaseIds(await minecraftVersions().catch(() => []))

  try {
    return fromArchive(readArchiveInfo(body), releases)
  } catch {
    // not a readable archive, fall through to the schematic reader
  }

  try {
    const out = fromSchematic(parseSchematic(body))
    if (sha512) await attachPreview(out, body, sha512)
    return out
  } catch (e) {
    const out = blank()
    out.warnings.push({
      code: 'catalog.warn.unreadable',
      params: { filename, reason: (e as Error).message },
    })
    return out
  }
}

// The preview is built once, at upload, and parked in storage next to the file
// it came from. Viewing a schematic then costs a CDN hit and no parsing at all.
// The key is the source hash, so re-uploading the same build reuses it.
async function attachPreview(out: UploadAnalysis, body: Uint8Array, sha512: string) {
  try {
    const payload = voxelize(schematicGrid(body))
    const url = await storeDerived(
      previewKey(sha512), JSON.stringify(previewDocument(payload)), 'application/json')

    if (url) out.meta.preview = url
    out.meta.previewShown = payload.shown
    if (payload.truncated) {
      out.warnings.push({ code: 'catalog.warn.previewTruncated', params: {} })
    }
  } catch (e) {
    out.warnings.push({ code: 'catalog.warn.noPreview', params: { reason: (e as Error).message } })
  }
}
