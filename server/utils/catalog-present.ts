
import type { FileRow, ProjectRow, VersionRow } from './catalog'
import { num } from './catalog'
import { projectPath } from '../../shared/utils/catalog-types'
import { publicContentUrl } from './content-store'

export interface PublicFile {
  id: string
  filename: string
  size: number
  hashes: { sha1: string, sha512: string }
  primary: boolean
  url: string | null
}

export function publicFile(row: FileRow): PublicFile {
  return {
    id: row.id,
    filename: row.filename,
    size: num(row.size),
    hashes: { sha1: row.sha1, sha512: row.sha512 },
    primary: row.is_primary,
    url: publicContentUrl(row.object_key),
  }
}

export function shortVersion(row: VersionRow, files: FileRow[]) {
  return {
    id: row.id,
    projectId: row.project_id,
    number: row.number,
    name: row.name || row.number,
    channel: row.channel,
    gameVersions: row.game_versions,
    loaders: row.loaders,
    downloads: num(row.downloads),
    created: num(row.created),
    meta: row.meta,
    files: files.map(publicFile),
  }
}

export function fullVersion(row: VersionRow, files: FileRow[]) {
  return { ...shortVersion(row, files), changelog: row.changelog }
}

export function shortProject(row: ProjectRow) {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    path: projectPath(row.type, row.slug),
    title: row.title,
    summary: row.summary,
    status: row.status,
    icon: row.icon,
    categories: row.categories,
    gameVersions: row.game_versions,
    loaders: row.loaders,
    downloads: num(row.downloads),
    follows: row.follows,
    price: Number(row.price ?? 0),
    currency: row.currency,
    created: num(row.created),
    updated: num(row.updated),
  }
}

export function fullProject(row: ProjectRow, versions: VersionRow[], files: FileRow[]) {
  const byVersion = new Map<string, FileRow[]>()
  for (const file of files) {
    const list = byVersion.get(file.version_id) ?? []
    list.push(file)
    byVersion.set(file.version_id, list)
  }

  return {
    ...shortProject(row),
    description: row.description,
    license: row.license,
    licenseUrl: row.license_url,
    links: row.links,
    disclosures: row.disclosures,
    meta: row.meta,
    ownerId: row.owner_id,
    orgId: row.org_id,
    published: row.published === null ? null : num(row.published),
    // fullVersion rather than shortVersion: the project page has a changelog
    // tab, and a changelog nobody sends is a tab with nothing in it.
    versions: versions.map(v => fullVersion(v, byVersion.get(v.id) ?? [])),
  }
}
