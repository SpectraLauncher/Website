import { describe, expect, it } from 'vitest'

import {
  DOWNLOAD_WEIGHT,
  VIEW_WEIGHT,
  looksAutomated,
  metricDay,
  revenueShares,
  visitorKey,
} from '../../server/utils/attribution'

describe('metricDay', () => {
  it('to data UTC w formacie YYYY-MM-DD', () => {
    expect(metricDay(Date.UTC(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(metricDay(Date.UTC(2026, 0, 6, 0, 1))).toBe('2026-01-06')
  })
})

describe('looksAutomated', () => {
  it('przepuszcza prawdziwe przegladarki', () => {
    for (const agent of [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Safari/605.1.15',
    ]) {
      expect(looksAutomated(agent), agent.slice(0, 30)).toBe(false)
    }
  })

  it('odsiewa to, co samo sie przedstawia jako automat', () => {
    for (const agent of [
      'Googlebot/2.1', 'curl/8.4.0', 'python-requests/2.31', 'DiscordBot (+https://discord.com)',
      'HeadlessChrome/120', 'UptimeRobot/2.0', 'facebookexternalhit/1.1',
    ]) {
      expect(looksAutomated(agent), agent).toBe(true)
    }
  })

  it('brak lub szczatkowy user agent liczy sie jako automat', () => {
    expect(looksAutomated(undefined)).toBe(true)
    expect(looksAutomated('')).toBe(true)
    expect(looksAutomated('x')).toBe(true)
  })
})

describe('visitorKey', () => {
  const event = (ip: string, agent: string) =>
    ({ headers: { 'cf-connecting-ip': ip, 'user-agent': agent } }) as never

  it('ten sam odwiedzajacy tego samego dnia daje ten sam klucz', () => {
    const a = visitorKey(event('1.2.3.4', 'Mozilla/5.0'), '2026-01-05')
    const b = visitorKey(event('1.2.3.4', 'Mozilla/5.0'), '2026-01-05')
    expect(a).toBe(b)
  })

  // Klucz zmienia sie z dniem, wiec tej samej osoby nie da sie sledzic miedzy
  // dniami — to jest cala roznica miedzy deduplikacja a profilowaniem.
  it('nastepnego dnia ten sam odwiedzajacy ma inny klucz', () => {
    expect(visitorKey(event('1.2.3.4', 'Mozilla/5.0'), '2026-01-05'))
      .not.toBe(visitorKey(event('1.2.3.4', 'Mozilla/5.0'), '2026-01-06'))
  })

  it('rozni odwiedzajacy maja rozne klucze', () => {
    expect(visitorKey(event('1.2.3.4', 'Mozilla/5.0'), '2026-01-05'))
      .not.toBe(visitorKey(event('5.6.7.8', 'Mozilla/5.0'), '2026-01-05'))
  })

  it('klucz nie zawiera adresu ani user agenta', () => {
    const key = visitorKey(event('203.0.113.42', 'Mozilla/5.0 SomeBrowser'), '2026-01-05')
    expect(key).not.toContain('203.0.113')
    expect(key).not.toContain('SomeBrowser')
    expect(key).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })
})

describe('revenueShares', () => {
  it('udzialy sumuja sie do jedynki', () => {
    const shares = revenueShares([
      { project_id: 'a', views: 100, downloads: 20 },
      { project_id: 'b', views: 50, downloads: 10 },
      { project_id: 'c', views: 1, downloads: 0 },
    ])
    const total = shares.reduce((sum, s) => sum + s.share, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('liczy udzial z wag wyswietlen i pobran', () => {
    const shares = revenueShares([
      { project_id: 'a', views: 3, downloads: 1 },
      { project_id: 'b', views: 1, downloads: 3 },
    ])
    // Przy rownych wagach oba maja te sama sume, wiec dziela sie po polowie.
    expect(VIEW_WEIGHT).toBe(DOWNLOAD_WEIGHT)
    expect(shares[0]!.share).toBeCloseTo(0.5, 10)
    expect(shares[1]!.share).toBeCloseTo(0.5, 10)
  })

  it('sortuje malejaco po udziale', () => {
    const shares = revenueShares([
      { project_id: 'small', views: 1, downloads: 0 },
      { project_id: 'big', views: 100, downloads: 0 },
    ])
    expect(shares[0]!.projectId).toBe('big')
  })

  // Okres bez ruchu nie moze podzielic niczego przez zero.
  it('pusty okres daje zerowe udzialy, a nie NaN', () => {
    expect(revenueShares([])).toEqual([])
    const zeroed = revenueShares([{ project_id: 'a', views: 0, downloads: 0 }])
    expect(zeroed[0]!.share).toBe(0)
    expect(Number.isNaN(zeroed[0]!.share)).toBe(false)
  })
})
