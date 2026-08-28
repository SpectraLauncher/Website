
import { exec } from './db'

export const ALLOWED_EVENTS = new Set([
  'app_start',
  'launch',
  'feature',
  'update',
  'crash',
])

const RETENTION_DAYS = 90

export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

export function clampStr(v: unknown, max = 64): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return s ? s.slice(0, max) : undefined
}

export function pruneOld() {
  return exec('DELETE FROM events WHERE day < $1', [dayKey(Date.now() - RETENTION_DAYS * 86_400_000)])
}

export function tokenOk(provided: unknown, expected: string): boolean {
  return typeof provided === 'string' && expected.length > 0 && provided === expected
}
