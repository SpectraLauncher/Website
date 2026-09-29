import { readContent } from './content-store'
import { exec } from './db'
import { type Zip, ZipError, openZip, unsafeEntryName } from './zip'

export const ADDON_MANIFEST = 'addon.json'

export const ADDON_API_VERSIONS: readonly number[] = [1]

export const ADDON_PERMISSIONS = [
  'instances:read',
  'instances:write',
  'instances:launch',
  'logs:read',
  'servers:ping',
  'account:read',
  'skins:read',
] as const

export const ADDON_LIMITS = {
  entries: 20,
  permissions: 30,
}

export interface AddonView {
  id: string
  title: string
  entry: string
  icon: string | null
}

export interface AddonTheme {
  id: string
  name: string
  file: string
}

export interface AddonManifest {
  id: string
  name: string
  version: string
  description: string | null
  api: number
  launcher: string | null
  main: string | null
  backend: string | null
  permissions: string[]
  contributes: {
    pages: AddonView[]
    instanceTabs: AddonView[]
    settings: string | null
    themes: AddonTheme[]
    locales: Record<string, string>
  }
}

export class AddonManifestError extends Error {}

const ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,59}$/
const RANGE = /^[0-9A-Za-z.*<>=~^|\s-]{1,64}$/
const HOST = /^network:(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const LOCALE = /^[a-z]{2}(?:-[A-Z]{2})?$/

function fail(message: string): never {
  throw new AddonManifestError(message)
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} must be an object`)
  return value as Record<string, unknown>
}

function string(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} is required`)
  const out = value.trim()
  if (out.length > max) fail(`${field} is longer than ${max} characters`)
  return out
}

function optionalString(value: unknown, field: string, max: number): string | null {
  return value === undefined || value === null ? null : string(value, field, max)
}

function path(zip: Zip, value: unknown, field: string, extensions: string[]): string {
  const name = string(value, field, 256).replace(/^\.\//, '')
  if (unsafeEntryName(name)) fail(`${field} is not a path inside the archive`)
  if (!extensions.some(ext => name.toLowerCase().endsWith(ext))) {
    fail(`${field} has to end in ${extensions.join(' or ')}`)
  }
  if (!zip.has(name)) fail(`${field} points at ${name}, which is not in the archive`)
  return name
}

function optionalPath(zip: Zip, value: unknown, field: string, extensions: string[]): string | null {
  return value === undefined || value === null ? null : path(zip, value, field, extensions)
}

function list(value: unknown, field: string, max: number): unknown[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) fail(`${field} must be a list`)
  if (value.length > max) fail(`${field} has more than ${max} entries`)
  return value
}

function uniqueIds<T extends { id: string }>(items: T[], field: string): T[] {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) fail(`${field} repeats the id ${item.id}`)
    seen.add(item.id)
  }
  return items
}

function views(zip: Zip, value: unknown, field: string): AddonView[] {
  return uniqueIds(list(value, field, ADDON_LIMITS.entries).map((raw, i) => {
    const entry = object(raw, `${field}[${i}]`)
    const id = string(entry.id, `${field}[${i}].id`, 64)
    if (!ID.test(id)) fail(`${field}[${i}].id may only use a-z, 0-9 and dashes`)
    return {
      id,
      title: string(entry.title, `${field}[${i}].title`, 64),
      entry: path(zip, entry.entry, `${field}[${i}].entry`, ['.html']),
      icon: optionalString(entry.icon, `${field}[${i}].icon`, 64),
    }
  }), field)
}

function themes(zip: Zip, value: unknown): AddonTheme[] {
  return uniqueIds(list(value, 'contributes.themes', ADDON_LIMITS.entries).map((raw, i) => {
    const entry = object(raw, `contributes.themes[${i}]`)
    const id = string(entry.id, `contributes.themes[${i}].id`, 64)
    if (!ID.test(id)) fail(`contributes.themes[${i}].id may only use a-z, 0-9 and dashes`)
    return {
      id,
      name: string(entry.name, `contributes.themes[${i}].name`, 64),
      file: path(zip, entry.file, `contributes.themes[${i}].file`, ['.json']),
    }
  }), 'contributes.themes')
}

function locales(zip: Zip, value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {}
  const entries = Object.entries(object(value, 'contributes.locales'))
  if (entries.length > ADDON_LIMITS.entries) fail(`contributes.locales has more than ${ADDON_LIMITS.entries} entries`)
  return Object.fromEntries(entries.map(([code, file]) => {
    if (!LOCALE.test(code)) fail(`contributes.locales has an unknown language code ${code}`)
    return [code, path(zip, file, `contributes.locales.${code}`, ['.json'])]
  }))
}

function permissions(value: unknown): string[] {
  const raw = list(value, 'permissions', ADDON_LIMITS.permissions)
  const out = new Set<string>()
  for (const [i, entry] of raw.entries()) {
    if (typeof entry !== 'string') fail(`permissions[${i}] must be a string`)
    const known = (ADDON_PERMISSIONS as readonly string[]).includes(entry)
    if (!known && !HOST.test(entry)) fail(`permissions[${i}] is not a permission: ${entry}`)
    out.add(entry)
  }
  return [...out].sort()
}

export function readAddonManifest(zip: Zip): AddonManifest | null {
  if (!zip.has(ADDON_MANIFEST)) return null

  let raw: unknown
  try {
    raw = zip.readJson(ADDON_MANIFEST)
  } catch {
    fail(`${ADDON_MANIFEST} is not valid JSON`)
  }
  const doc = object(raw, ADDON_MANIFEST)

  const id = string(doc.id, 'id', 64)
  if (!ID.test(id)) fail('id may only use a-z, 0-9 and dashes, and cannot start or end with a dash')

  const version = string(doc.version, 'version', 60)
  if (!VERSION.test(version)) fail('version may only use letters, digits, dots, dashes and plus signs')

  if (typeof doc.api !== 'number' || !ADDON_API_VERSIONS.includes(doc.api)) {
    fail(`api has to be one of ${ADDON_API_VERSIONS.join(', ')}`)
  }

  const launcher = optionalString(doc.launcher, 'launcher', 64)
  if (launcher && !RANGE.test(launcher)) fail('launcher is not a version range')

  const contributes = doc.contributes === undefined ? {} : object(doc.contributes, 'contributes')

  const manifest: AddonManifest = {
    id,
    name: string(doc.name, 'name', 64),
    version,
    description: optionalString(doc.description, 'description', 400),
    api: doc.api,
    launcher,
    main: optionalPath(zip, doc.main, 'main', ['.js', '.mjs']),
    backend: optionalPath(zip, doc.backend, 'backend', ['.wasm']),
    permissions: permissions(doc.permissions),
    contributes: {
      pages: views(zip, contributes.pages, 'contributes.pages'),
      instanceTabs: views(zip, contributes.instanceTabs, 'contributes.instanceTabs'),
      settings: optionalPath(zip, contributes.settings, 'contributes.settings', ['.html']),
      themes: themes(zip, contributes.themes),
      locales: locales(zip, contributes.locales),
    },
  }

  const c = manifest.contributes
  const empty = !manifest.main && !manifest.backend && !c.pages.length && !c.instanceTabs.length
    && !c.settings && !c.themes.length && !Object.keys(c.locales).length
  if (empty) fail('the addon does not contribute anything')

  return manifest
}

export function addonMeta(manifest: AddonManifest): Record<string, unknown> {
  return {
    addonId: manifest.id,
    api: manifest.api,
    launcher: manifest.launcher,
    main: manifest.main,
    backend: manifest.backend,
    permissions: manifest.permissions,
    contributes: manifest.contributes,
  }
}

export async function readAddonFile(key: string): Promise<AddonManifest> {
  const body = await readContent(key)
  if (!body) throw createError({ statusCode: 409, statusMessage: 'upload the file again' })

  let manifest: AddonManifest | null
  try {
    manifest = readAddonManifest(openZip(body))
  } catch (e) {
    if (e instanceof AddonManifestError || e instanceof ZipError) {
      throw createError({ statusCode: 400, statusMessage: `addon.json: ${e.message}` })
    }
    throw e
  }

  if (!manifest) throw createError({ statusCode: 400, statusMessage: 'the file has no addon.json' })
  return manifest
}

export async function claimAddonId(project: { id: string, meta: Record<string, unknown> }, addonId: string) {
  const pinned = typeof project.meta?.addonId === 'string' ? project.meta.addonId : null
  if (pinned) {
    if (pinned !== addonId) {
      throw createError({ statusCode: 400, statusMessage: `addon.json id has to stay ${pinned}` })
    }
    return
  }

  try {
    await exec(
      `UPDATE project SET meta = meta || jsonb_build_object('addonId', $2::text)
       WHERE id = $1 AND NOT (meta ? 'addonId')`,
      [project.id, addonId],
    )
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'another addon already uses this id' })
    }
    throw e
  }
}

export function addonVersionInput(manifest: AddonManifest) {
  return {
    number: manifest.version,
    loaders: ['spectra'],
    gameVersions: [],
    meta: addonMeta(manifest),
  }
}
