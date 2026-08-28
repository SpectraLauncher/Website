
import pg from 'pg'

let pool: pg.Pool | null = null

export function usePool(): pg.Pool {
  if (pool) return pool
  const cache = globalThis as typeof globalThis & { __spectraPool?: pg.Pool }
  if (cache.__spectraPool) {
    pool = cache.__spectraPool
    return pool
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw createError({ statusCode: 500, statusMessage: 'DATABASE_URL is not set' })
  }

  const created = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  created.on('error', e => console.error('[db] idle client error', e))

  pool = created
  cache.__spectraPool = created
  return pool
}

export async function q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await usePool().query(sql, params)
  return res.rows as T[]
}

export async function one<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await q<T>(sql, params)
  return rows[0]
}

export async function exec(sql: string, params: unknown[] = []): Promise<number> {
  const res = await usePool().query(sql, params)
  return res.rowCount ?? 0
}
