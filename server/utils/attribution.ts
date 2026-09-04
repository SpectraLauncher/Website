
import { createHmac } from 'node:crypto'
import type { H3Event } from 'h3'

import { exec, one, q } from './db'
import { clientIp } from './rateLimit'

export function metricDay(at = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10)
}

// Crawlers do not earn anyone a share. This is a coarse filter and it is meant
// to be: a bot that hides itself is a smaller problem than a bot that announces
// itself and gets counted anyway.
const BOT = /bot|crawl|spider|slurp|curl|wget|python-requests|headless|preview|scrape|monitor|uptime|facebookexternalhit|discordbot|whatsapp|telegram/i

export function looksAutomated(userAgent: string | undefined): boolean {
  if (!userAgent || userAgent.length < 8) return true
  return BOT.test(userAgent)
}

// A browser fetching a page it merely expects the reader might open has not
// shown it to anyone.
export function isPrefetch(event: H3Event): boolean {
  const purpose = getHeader(event, 'sec-purpose') || getHeader(event, 'purpose') || ''
  return /prefetch|prerender/i.test(purpose)
}

// Keyed with the day, so the same visitor is not linkable across days, and
// keyed with a secret, so the value cannot be produced from an address alone.
export function visitorKey(event: H3Event, day: string): string {
  const secret = process.env.BETTER_AUTH_SECRET || 'spectra-attribution'
  const agent = getHeader(event, 'user-agent') ?? ''
  return createHmac('sha256', `${secret}:${day}`)
    .update(`${clientIp(event)}|${agent}`)
    .digest('base64url')
    .slice(0, 22)
}

export async function recordView(event: H3Event, projectId: string): Promise<boolean> {
  if (isPrefetch(event) || looksAutomated(getHeader(event, 'user-agent'))) return false

  const day = metricDay()

  // Nothing is counted unless this insert actually created a row, which is what
  // makes a refresh free rather than another view.
  const first = await exec(
    `INSERT INTO project_view_seen (project_id, day, visitor) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [projectId, day, visitorKey(event, day)],
  )
  if (!first) return false

  await exec(
    `INSERT INTO project_metric (project_id, day, views) VALUES ($1, $2, 1)
     ON CONFLICT (project_id, day) DO UPDATE SET views = project_metric.views + 1`,
    [projectId, day],
  )
  return true
}

export async function recordDownload(projectId: string) {
  await exec(
    `INSERT INTO project_metric (project_id, day, downloads) VALUES ($1, $2, 1)
     ON CONFLICT (project_id, day) DO UPDATE SET downloads = project_metric.downloads + 1`,
    [projectId, metricDay()],
  )
}

const SEEN_RETENTION_DAYS = 3

export async function pruneViewSeen(): Promise<number> {
  return await exec('DELETE FROM project_view_seen WHERE day < $1',
    [metricDay(Date.now() - SEEN_RETENTION_DAYS * 86_400_000)])
}

export interface MetricRow {
  project_id: string
  views: number
  downloads: number
}

export interface Share {
  projectId: string
  views: number
  downloads: number
  weight: number
  share: number
}

// Modrinth splits by views and downloads together; this keeps the same shape so
// the weighting can be tuned without touching how anything is collected.
export const VIEW_WEIGHT = 1
export const DOWNLOAD_WEIGHT = 1

// The split for a period. Returned as fractions rather than money so the same
// numbers can be shown in a dashboard long before anything is paid out.
export function revenueShares(rows: MetricRow[]): Share[] {
  const weighted = rows.map(row => ({
    projectId: row.project_id,
    views: Number(row.views) || 0,
    downloads: Number(row.downloads) || 0,
    weight: (Number(row.views) || 0) * VIEW_WEIGHT
      + (Number(row.downloads) || 0) * DOWNLOAD_WEIGHT,
  }))

  const total = weighted.reduce((sum, row) => sum + row.weight, 0)

  return weighted
    .map(row => ({ ...row, share: total > 0 ? row.weight / total : 0 }))
    .sort((a, b) => b.share - a.share || a.projectId.localeCompare(b.projectId))
}

export async function metricsBetween(from: string, to: string): Promise<MetricRow[]> {
  return await q<MetricRow>(
    `SELECT project_id, SUM(views)::int AS views, SUM(downloads)::int AS downloads
     FROM project_metric WHERE day >= $1 AND day <= $2
     GROUP BY project_id`,
    [from, to],
  )
}

export async function metricsForProject(projectId: string, days: number) {
  const from = metricDay(Date.now() - days * 86_400_000)
  return await q<{ day: string, views: number, downloads: number }>(
    `SELECT day, views, downloads FROM project_metric
     WHERE project_id = $1 AND day >= $2 ORDER BY day`,
    [projectId, from],
  )
}

export async function totalsForProject(projectId: string) {
  return await one<{ views: number, downloads: number }>(
    `SELECT COALESCE(SUM(views), 0)::int AS views,
            COALESCE(SUM(downloads), 0)::int AS downloads
     FROM project_metric WHERE project_id = $1`,
    [projectId],
  )
}

export async function projectTitles(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const rows = await q<{ id: string, title: string }>(
    'SELECT id, title FROM project WHERE id = ANY($1)', [ids])
  return new Map(rows.map(row => [row.id, row.title]))
}
