import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { drainForTests, enqueue, queueDepth, resetQueue } from '../../server/utils/queue'

beforeEach(resetQueue)
afterEach(() => vi.useRealTimers())

describe('kolejka', () => {
  it('wykonuje zadanie poza wywolaniem', async () => {
    const seen: string[] = []
    enqueue('mail', async () => { seen.push('done') })

    await drainForTests()
    expect(seen).toEqual(['done'])
  })

  // Zawieszony SMTP nie moze byc tym, na co czeka czlowiek.
  it('enqueue nie czeka na zadanie', () => {
    let finished = false
    enqueue('mail', async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
      finished = true
    })
    expect(finished).toBe(false)
  })

  it('ponawia trzy razy i odpuszcza, nie wywracajac procesu', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()

    let tries = 0
    enqueue('scan', async () => {
      tries++
      throw new Error('nope')
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(tries).toBe(1)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(tries).toBe(2)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(tries).toBe(3)
    expect(queueDepth().failures.scan).toBe(1)
  })

  // Zadanie czekajace na ponowienie nie jest ani pending, ani running. Bez
  // osobnego licznika glebokosc pokazuje zero, choc praca wciaz jest do zrobienia.
  it('zadanie czekajace na ponowienie jest widoczne w glebokosci', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()

    enqueue('scan', async () => { throw new Error('nope') })
    await vi.advanceTimersByTimeAsync(0)

    expect(queueDepth().retrying).toBe(1)
    expect(queueDepth().pending).toBe(0)
    expect(queueDepth().running).toBe(0)
  })

  it('jedno zle zadanie nie blokuje reszty', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()

    const seen: string[] = []
    enqueue('scan', async () => { throw new Error('nope') })
    enqueue('mail', async () => { seen.push('ok') })

    await vi.advanceTimersByTimeAsync(0)
    expect(seen).toEqual(['ok'])
  })
})
