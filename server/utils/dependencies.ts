
import { exec, q } from './db'
import { newId } from './ids'
import type { PackFile } from './mod-manifest'

export interface DependencyRow {
  id: string
  version_id: string
  kind: string
  project_id: string | null
  depends_on: string | null
  external: Record<string, unknown> | null
}

const CDN = /^https?:\/\/cdn\.modrinth\.com\/data\/([A-Za-z0-9]+)\/versions\/([A-Za-z0-9]+)\//

export function externalRef(file: PackFile): Record<string, unknown> {
  const match = file.downloads.map(url => CDN.exec(url)).find(Boolean)

  return {
    path: file.path,
    sha512: file.hashes.sha512,
    size: file.size,
    downloads: file.downloads.slice(0, 4),
    ...(match ? { source: 'modrinth', projectId: match[1], versionId: match[2] } : {}),
  }
}

export async function replaceDependencies(versionId: string, files: PackFile[]) {
  await exec('DELETE FROM version_dependency WHERE version_id = $1', [versionId])
  if (!files.length) return

  // A pack file we already host is linked to our own version rather than to a
  // foreign URL, which is what the sha512 index on version_file is for.
  const hashes = files.map(file => file.hashes.sha512).filter(Boolean)
  const mine = await q<{ sha512: string, version_id: string }>(
    'SELECT sha512, version_id FROM version_file WHERE sha512 = ANY($1)', [hashes])
  const known = new Map(mine.map(row => [row.sha512, row.version_id]))

  for (const file of files) {
    const local = known.get(file.hashes.sha512)

    await exec(
      `INSERT INTO version_dependency (id, version_id, kind, depends_on, external)
       VALUES ($1, $2, 'required', $3, $4)`,
      [
        newId(),
        versionId,
        local ?? null,
        local ? null : JSON.stringify(externalRef(file)),
      ],
    )
  }
}

export async function dependenciesOf(versionId: string) {
  const rows = await q<DependencyRow & {
    project_slug: string | null
    project_type: string | null
    project_title: string | null
    version_number: string | null
  }>(
    `SELECT d.id, d.version_id, d.kind, d.project_id, d.depends_on, d.external,
            p.slug AS project_slug, p.type AS project_type, p.title AS project_title,
            v.number AS version_number
     FROM version_dependency d
     LEFT JOIN version v ON v.id = d.depends_on
     LEFT JOIN project p ON p.id = COALESCE(d.project_id, v.project_id)
     WHERE d.version_id = $1
     ORDER BY p.title NULLS LAST, d.id`,
    [versionId],
  )

  return rows.map(row => ({
    id: row.id,
    kind: row.kind,
    hosted: Boolean(row.depends_on || row.project_id),
    slug: row.project_slug,
    type: row.project_type,
    title: row.project_title,
    versionNumber: row.version_number,
    external: row.external,
  }))
}
