import { type FileRow, type ProjectRow, type VersionRow } from './catalog'
import { q } from './db'

export type HashAlgorithm = 'sha1' | 'sha512'

export function hashAlgorithm(raw: unknown): HashAlgorithm {
  return raw === 'sha512' ? 'sha512' : 'sha1'
}

export function isHash(value: string, algorithm: HashAlgorithm): boolean {
  return algorithm === 'sha1' ? /^[0-9a-f]{40}$/.test(value) : /^[0-9a-f]{128}$/.test(value)
}

export interface HashMatch {
  hash: string
  file: FileRow
  version: VersionRow
  project: ProjectRow
}

// One query for any number of hashes, because a launcher scanning a mods folder
// asks about two hundred files at once and will not do it one request at a time.
export async function versionsByHash(
  hashes: string[],
  algorithm: HashAlgorithm,
): Promise<HashMatch[]> {
  if (!hashes.length) return []

  const column = algorithm === 'sha512' ? 'f.sha512' : 'f.sha1'

  // sql-safe: `column` is one of two constants chosen above, never request text
  const rows = await q<Record<string, any>>(
    `SELECT ${column} AS hash,
            f.id::text AS f_id, f.version_id::text AS f_version, f.filename, f.size,
            f.sha1, f.sha512, f.is_primary, f.object_key, f.created AS f_created,
            v.id::text AS v_id, v.project_id::text AS v_project, v.number, v.name,
            v.changelog, v.channel, v.game_versions AS v_game_versions,
            v.loaders AS v_loaders, v.meta AS v_meta, v.downloads AS v_downloads,
            v.created AS v_created,
            p.id::text AS p_id, p.slug, p.type, p.status, p.title, p.summary,
            p.description, p.license, p.license_url, p.icon, p.categories,
            p.game_versions AS p_game_versions, p.loaders AS p_loaders, p.links,
            p.meta AS p_meta, p.downloads AS p_downloads, p.follows,
            p.owner_id, p.org_id, p.created AS p_created, p.updated, p.published
     FROM version_file f
     JOIN version v ON v.id = f.version_id
     JOIN project p ON p.id = v.project_id
     WHERE ${column} = ANY($1)`,
    [hashes],
  )

  return rows.map(row => ({
    hash: row.hash,
    file: {
      id: row.f_id, version_id: row.f_version, filename: row.filename, size: row.size,
      sha1: row.sha1, sha512: row.sha512, is_primary: row.is_primary,
      object_key: row.object_key, created: row.f_created,
    },
    version: {
      id: row.v_id, project_id: row.v_project, number: row.number, name: row.name,
      changelog: row.changelog, channel: row.channel, game_versions: row.v_game_versions,
      loaders: row.v_loaders, meta: row.v_meta, downloads: row.v_downloads,
      created: row.v_created,
    },
    project: {
      id: row.p_id, slug: row.slug, type: row.type, status: row.status, title: row.title,
      summary: row.summary, description: row.description, license: row.license,
      license_url: row.license_url, icon: row.icon, categories: row.categories,
      game_versions: row.p_game_versions, loaders: row.p_loaders, links: row.links,
      meta: row.p_meta, downloads: row.p_downloads, follows: row.follows,
      owner_id: row.owner_id, org_id: row.org_id, created: row.p_created,
      updated: row.updated, published: row.published,
    },
  })) as HashMatch[]
}

// Third-party tools run in a browser, so the compatibility surface has to say so.
export function allowAnyOrigin(event: import('h3').H3Event) {
  setHeader(event, 'access-control-allow-origin', '*')
}
