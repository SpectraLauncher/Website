
import type { H3Event } from 'h3'

import { type FileRow, type ProjectRow, type VersionRow, num } from './catalog'
import { exec, one } from './db'

export function listParam(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : [value]
  const out = raw
    .filter((v): v is string => typeof v === 'string')
    .flatMap(v => v.split(','))
    .map(v => v.trim())
    .filter(Boolean)
    .slice(0, 50)
  return out.length ? out : undefined
}

// An unlisted project opens for anyone holding the address. A draft, a rejected
// project or a removed one opens only for whoever owns it, and for an admin —
// and "does not open" means 404, never 403, like the rest of the panel.
export async function visibleProject(
  project: ProjectRow | undefined,
  viewer: { id?: string, role?: string | null } | null,
): Promise<boolean> {
  if (!project) return false
  if (isLinkable(project.status)) return true
  if (!viewer) return false
  if (isAdmin(viewer)) return true
  if (project.owner_id && project.owner_id === viewer.id) return true
  if (project.org_id && viewer.id) return Boolean(await isOrgMember(project.org_id, viewer.id))
  return false
}

export function groupFiles(files: FileRow[]): Map<string, FileRow[]> {
  const out = new Map<string, FileRow[]>()
  for (const file of files) {
    const list = out.get(file.version_id) ?? []
    list.push(file)
    out.set(file.version_id, list)
  }
  return out
}

// A weak ETag off the row's own updated stamp. The launcher checks a few hundred
// projects on every start and almost none of them have moved.
export function notModified(event: H3Event, project: ProjectRow): boolean {
  const etag = `W/"${project.id}-${num(project.updated)}"`
  setResponseHeader(event, 'etag', etag)
  setResponseHeader(event, 'cache-control', 'no-cache')

  if (getRequestHeader(event, 'if-none-match') === etag) {
    setResponseStatus(event, 304)
    return true
  }
  return false
}

export interface DownloadTarget {
  file: FileRow
  version: VersionRow
  project: ProjectRow
}

export async function downloadTarget(fileId: string): Promise<DownloadTarget | undefined> {
  const row = await one<{
    file_id: string
    version_id: string
    project_id: string
    filename: string
    object_key: string
    status: string
    updated: string
  }>(
    `SELECT f.id AS file_id, f.version_id, v.project_id,
            f.filename, f.object_key, p.status, p.updated
     FROM version_file f
     JOIN version v ON v.id = f.version_id
     JOIN project p ON p.id = v.project_id
     WHERE f.id = $1`,
    [fileId],
  )
  if (!row) return undefined

  return {
    file: { object_key: row.object_key, filename: row.filename, id: row.file_id } as FileRow,
    version: { id: row.version_id, project_id: row.project_id } as VersionRow,
    project: { id: row.project_id, status: row.status, updated: row.updated } as ProjectRow,
  }
}

// ponytail: two hot-row UPDATEs per download. Move to an append-only counter
// table with periodic aggregation if a popular file ever makes these contend.
export async function countDownload(
  versionId: string | number,
  projectId: string | number,
) {
  await exec('UPDATE version SET downloads = downloads + 1 WHERE id = $1', [versionId])
  await exec('UPDATE project SET downloads = downloads + 1 WHERE id = $1', [projectId])
}
