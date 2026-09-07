
import { scanArchive } from './file-scan'
import { exec, one, q } from './db'
import { enqueue } from './queue'
import { readContent } from './content-store'

export interface FlaggedFile {
  id: string
  filename: string
  verdict: string
  findings: Array<{ code: string, severity: string, detail: string }>
  scannedAt: number | null
  projectId: string
  projectTitle: string
  versionNumber: string
}

// Scanning happens off the request: a 200 MB jar takes seconds to walk and the
// person uploading it should not be the one waiting.
export function queueScan(fileId: string) {
  return enqueue('scan', { fileId })
}

export async function scanFile(fileId: string): Promise<void> {
  const file = await one<{ id: string, object_key: string, filename: string }>(
    'SELECT id, object_key, filename FROM version_file WHERE id = $1',
    [fileId],
  )
  if (!file) return

  const body = await readContent(file.object_key)
  if (!body) {
    await store(fileId, 'unreadable', [{
      code: 'missing',
      severity: 'medium',
      detail: 'the stored object could not be read back',
    }])
    return
  }

  const result = scanArchive(body)
  await store(fileId, result.verdict, result.findings)
}

function store(fileId: string, verdict: string, findings: unknown) {
  return exec(
    `UPDATE version_file SET scan_verdict = $2, scan_findings = $3, scanned_at = $4
     WHERE id = $1`,
    [fileId, verdict, JSON.stringify(findings), Date.now()],
  )
}

export async function flaggedFiles(limit = 50): Promise<FlaggedFile[]> {
  const rows = await q<{
    id: string
    filename: string
    scan_verdict: string
    scan_findings: unknown
    scanned_at: string | number | null
    project_id: string
    title: string
    number: string
  }>(
    `SELECT f.id, f.filename, f.scan_verdict, f.scan_findings, f.scanned_at,
            p.id AS project_id, p.title, v.number
     FROM version_file f
     JOIN version v ON v.id = f.version_id
     JOIN project p ON p.id = v.project_id
     WHERE f.scan_verdict IS NOT NULL AND f.scan_verdict <> 'clean'
     ORDER BY f.scanned_at DESC NULLS LAST
     LIMIT $1`,
    [limit],
  )

  return rows.map(row => ({
    id: row.id,
    filename: row.filename,
    verdict: row.scan_verdict,
    findings: Array.isArray(row.scan_findings) ? row.scan_findings as FlaggedFile['findings'] : [],
    scannedAt: row.scanned_at === null ? null : Number(row.scanned_at),
    projectId: row.project_id,
    projectTitle: row.title,
    versionNumber: row.number,
  }))
}

export async function unscannedCount(): Promise<number> {
  const row = await one<{ n: number }>(
    'SELECT count(*)::int AS n FROM version_file WHERE scan_verdict IS NULL')
  return row?.n ?? 0
}

// A project cannot be published while a file on it is flagged or unexamined.
// This is the whole point of scanning: the queue has to be able to say no.
export async function blockingScanIssues(projectId: string): Promise<number> {
  const row = await one<{ n: number }>(
    `SELECT count(*)::int AS n
     FROM version_file f JOIN version v ON v.id = f.version_id
     WHERE v.project_id = $1 AND (f.scan_verdict IS NULL OR f.scan_verdict <> 'clean')`,
    [projectId],
  )
  return row?.n ?? 0
}

// Files that predate scanning. Nothing enqueues them on its own, so without a
// backfill an existing catalog sits at "never looked at" forever — and that
// state blocks publishing, which would make the first moderation action after
// the deploy fail for no visible reason.
export async function queueUnscanned(limit = 500): Promise<number> {
  const rows = await q<{ id: string }>(
    'SELECT id FROM version_file WHERE scan_verdict IS NULL LIMIT $1',
    [limit],
  )

  for (const row of rows) await queueScan(row.id)
  return rows.length
}
