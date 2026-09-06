import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({
  exec: vi.fn(async () => 1),
  one: vi.fn(async () => undefined),
  q: vi.fn(async () => []),
  usePool: vi.fn(),
}))

const { enqueue, registerJob, runJobs } = await import('../../server/utils/queue')
const db = await import('../../server/utils/db')

interface Statement { sql: string, params: unknown[] }

function calls(): Statement[] {
  return vi.mocked(db.exec).mock.calls.map(([sql, params]) => ({ sql, params: params ?? [] }))
}

const find = (needle: string) => calls().find(c => c.sql.includes(needle))

beforeEach(() => {
  vi.mocked(db.exec).mockClear().mockResolvedValue(1)
  vi.mocked(db.one).mockReset().mockResolvedValue(undefined)
})

describe('zadanie jest wierszem, nie domknieciem', () => {
  it('enqueue zapisuje rodzaj i payload', async () => {
    await enqueue('scan', { fileId: 'f1' })

    const insert = find('INSERT INTO job')
    expect(insert).toBeTruthy()
    expect(insert!.params).toContain('scan')
    expect(insert!.params).toContain(JSON.stringify({ fileId: 'f1' }))
  })

  // A closure does not survive a restart, so the payload has to be storable.
  it('payload przechodzi przez JSON', async () => {
    await enqueue('mail', { userId: 'u1', kind: 'project_approved', actorId: null })

    const insert = find('INSERT INTO job')!
    const stored = insert.params.find(p => typeof p === 'string' && p.startsWith('{')) as string
    expect(() => JSON.parse(stored)).not.toThrow()
  })
})

describe('branie zadania z kolejki', () => {
  it('nie bierze niczego, gdy kolejka pusta', async () => {
    expect(await runJobs()).toBe(0)
  })

  it('uruchamia handler zarejestrowany dla rodzaju', async () => {
    const seen: unknown[] = []
    registerJob('scan', async (payload) => { seen.push(payload) })

    vi.mocked(db.one)
      .mockResolvedValueOnce({ id: 'j1', kind: 'scan', payload: { fileId: 'f1' }, attempts: 0 })
      .mockResolvedValue(undefined)

    expect(await runJobs()).toBe(1)
    expect(seen).toEqual([{ fileId: 'f1' }])
    expect(find(`status = 'done'`)).toBeTruthy()
  })

  it('nieudane zadanie wraca do kolejki z opoznieniem', async () => {
    registerJob('scan', async () => { throw new Error('nope') })

    vi.mocked(db.one)
      .mockResolvedValueOnce({ id: 'j1', kind: 'scan', payload: {}, attempts: 0 })
      .mockResolvedValue(undefined)

    await runJobs()

    const retry = find(`status = 'pending', attempts`)
    expect(retry).toBeTruthy()
    expect(retry!.params).toContain(1)
  })

  it('po trzeciej probie odpuszcza zamiast krecic sie w kolko', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    registerJob('scan', async () => { throw new Error('nope') })

    vi.mocked(db.one)
      .mockResolvedValueOnce({ id: 'j1', kind: 'scan', payload: {}, attempts: 2 })
      .mockResolvedValue(undefined)

    await runJobs()
    expect(find(`status = 'failed'`)).toBeTruthy()
  })

  it('rodzaj bez handlera nie wywraca petli', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(db.one)
      .mockResolvedValueOnce({ id: 'j1', kind: 'nieznany', payload: {}, attempts: 0 })
      .mockResolvedValue(undefined)

    await expect(runJobs()).resolves.toBeGreaterThanOrEqual(0)
  })
})

// Several replicas share one table, so two must never take the same row.
describe('kilka procesow, jedna kolejka', () => {
  const source = readFileSync('server/utils/queue.ts', 'utf8')

  it('branie zadania omija wiersze zajete przez innego', () => {
    expect(source).toContain('FOR UPDATE SKIP LOCKED')
  })

  it('branie i oznaczanie dzieje sie jednym zapytaniem', () => {
    expect(source).toContain(`UPDATE job SET status = 'running'`)
    expect(source).toContain('RETURNING id, kind, payload, attempts')
  })

  // A process that died mid-job left its row claimed forever.
  it('martwa blokada wraca do kolejki po czasie', () => {
    expect(source).toContain('recoverStaleJobs')
    expect(source).toContain('LOCK_TIMEOUT_MS')
  })

  it('skonczone wiersze sa sprzatane, zeby tabela nie rosla w nieskonczonosc', () => {
    expect(source).toContain('pruneJobs')
    expect(source).toContain(`DELETE FROM job WHERE status = 'done'`)
  })
})

describe('poller', () => {
  const plugin = readFileSync('server/plugins/jobs.ts', 'utf8')

  it('petla przezywa bledy pojedynczego przebiegu', () => {
    expect(plugin).toContain('catch (e)')
    expect(plugin).toContain('finally')
  })

  it('da sie wylaczyc na replice serwujacej tylko zadania', () => {
    expect(plugin).toContain(`process.env.JOB_WORKER === 'false'`)
  })
})
