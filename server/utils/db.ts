import pg from 'pg'

let pool: pg.Pool | null = null
let readPool: pg.Pool | null = null

interface PoolCache {
  __spectraPool?: pg.Pool
  __spectraReadPool?: pg.Pool
}

function build(connectionString: string, max: number): pg.Pool {
  const created = new pg.Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  created.on('error', e => console.error('[db] idle client error', e))
  return created
}

export function usePool(): pg.Pool {
  if (pool) return pool

  const cache = globalThis as typeof globalThis & PoolCache
  if (cache.__spectraPool) {
    pool = cache.__spectraPool
    return pool
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw createError({ statusCode: 500, statusMessage: 'DATABASE_URL is not set' })
  }

  pool = build(connectionString, 10)
  cache.__spectraPool = pool
  return pool
}

// Reads may go to a replica. DATABASE_READ_URL is optional: without it this is
// the writer pool, so nothing has to know which kind of database it is talking
// to. A replica lags, so anything that reads its own write must not come here.
export function useReadPool(): pg.Pool {
  if (readPool) return readPool

  const connectionString = process.env.DATABASE_READ_URL
  if (!connectionString) return usePool()

  const cache = globalThis as typeof globalThis & PoolCache
  if (cache.__spectraReadPool) {
    readPool = cache.__spectraReadPool
    return readPool
  }

  readPool = build(connectionString, 10)
  cache.__spectraReadPool = readPool
  return readPool
}

export function hasReadReplica(): boolean {
  return Boolean(process.env.DATABASE_READ_URL)
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

// The read-only twins. They are separate functions rather than a flag because
// the choice belongs to the caller who knows whether stale data is acceptable,
// and a flag would be forgotten in exactly the places it matters.
export async function qRead<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await useReadPool().query(sql, params)
  return res.rows as T[]
}

export async function oneRead<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await qRead<T>(sql, params)
  return rows[0]
}
