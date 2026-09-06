import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  MAX_REPORT_BODY,
  REPORT_ITEM_TYPES,
  REPORT_REASONS,
  isReportItemType,
  isReportReason,
  isReportStatus,
} from '../../shared/utils/reports'

describe('rejestr zgloszen', () => {
  it('przyjmuje tylko znane powody', () => {
    for (const reason of REPORT_REASONS) expect(isReportReason(reason)).toBe(true)
    for (const bad of ['', 'wat', null, 42, {}]) {
      expect(isReportReason(bad), String(bad)).toBe(false)
    }
  })

  it('przyjmuje tylko znane typy obiektow', () => {
    for (const type of REPORT_ITEM_TYPES) expect(isReportItemType(type)).toBe(true)
    for (const bad of ['project; DROP TABLE report', 'projects', '', null]) {
      expect(isReportItemType(bad), String(bad)).toBe(false)
    }
  })

  it('open nie jest decyzja, ktora mozna wybrac', () => {
    expect(isReportStatus('open')).toBe(true)
    expect(isReportStatus('closed')).toBe(false)
  })
})

// The only place in the catalog where a table name reaches a query. It has to
// come from a fixed map, never from the request.
describe('nazwa tabeli nie pochodzi z zadania', () => {
  const source = readFileSync('server/utils/reports.ts', 'utf8')

  it('mapa typ -> tabela jest zapisana w kodzie', () => {
    for (const type of REPORT_ITEM_TYPES) {
      expect(source, type).toContain(`${type}:`)
    }
  })

  it('nieznany typ nie dochodzi do zapytania', () => {
    expect(source).toContain('if (!table) return false')
  })

  it('samo id zawsze idzie parametrem', () => {
    expect(source).toContain('WHERE id = $1')
    expect(source).not.toContain('WHERE id = \'')
  })
})

describe('trasa zgloszenia', () => {
  const source = readFileSync('server/api/catalog/reports.post.ts', 'utf8')

  it('waliduje powod i typ przed czymkolwiek innym', () => {
    expect(source).toContain('isReportReason(body.reason)')
    expect(source).toContain('isReportItemType(body.itemType)')
  })

  // The form must not double as a way to find out which ids are real.
  it('nieistniejacy obiekt daje 404, tak samo jak zle id', () => {
    expect(source).toContain('reportedItemExists(body.itemType, itemId)')
    expect(source).toContain(`statusCode: 404`)
  })

  it('ma budzet na konto, bo zgloszenie budzi kazdego moderatora', () => {
    expect(source).toContain('key: `report:${user.id}`')
    expect(source.indexOf('rateLimit(')).toBeLessThan(source.indexOf('readBody'))
  })

  it('tresc jest przycinana do limitu', () => {
    expect(source).toContain('MAX_REPORT_BODY')
    expect(MAX_REPORT_BODY).toBeGreaterThan(0)
  })
})

describe('zalewanie kolejki', () => {
  const schema = readFileSync('server/utils/schema-catalog.ts', 'utf8')
  const module = readFileSync('server/utils/reports.ts', 'utf8')

  // Without this one person files the same thing ten times and a moderator
  // cannot tell ten people from one persistent one.
  it('baza dopuszcza jedno otwarte zgloszenie na osobe i obiekt', () => {
    expect(schema).toContain('uniq_report_open')
    expect(schema).toContain(`WHERE status = 'open' AND reporter_id IS NOT NULL`)
  })

  it('powtorka daje czytelny blad, nie awarie', () => {
    expect(module).toContain('ON CONFLICT')
    expect(module).toContain('statusCode: 409')
  })
})

describe('zamkniecie zgloszenia', () => {
  const source = readFileSync('server/api/admin/catalog/reports/[id].patch.ts', 'utf8')

  it('tylko moderator', () => {
    expect(source).toContain('requireCatalogWrite(event)')
  })

  it('nie da sie zamknac na open', () => {
    expect(source).toContain(`body.status === 'open'`)
  })

  // A report that gets no answer teaches people not to bother reporting.
  it('zglaszajacy dostaje powiadomienie', () => {
    expect(source).toContain(`kind: 'report_closed'`)
  })
})

// A moderator who cannot ask which file exactly has to guess, and guessing is
// how a correct report gets dismissed.
describe('zgloszenie ma wlasny watek', () => {
  const thread = readFileSync('server/utils/project-thread.ts', 'utf8')
  const module = readFileSync('server/utils/reports.ts', 'utf8')
  const patch = readFileSync('server/api/admin/catalog/reports/[id].patch.ts', 'utf8')

  it('to ten sam mechanizm co watek projektu, nie druga tabela', () => {
    expect(thread).toContain('export async function reportThread')
    expect(thread).toContain('WHERE m.report_id = $1')
  })

  it('wiadomosc wisi przy projekcie albo przy zgloszeniu', () => {
    expect(thread).toContain('projectId?: string | null')
    expect(thread).toContain('reportId?: string | null')
  })

  it('watek widzi zglaszajacy i moderacja, nikt wiecej', () => {
    expect(module).toContain('report.reporter_id !== user.id')
    expect(module).toContain('isAdmin(user)')
  })

  it('obcy dostaje taka sama odpowiedz jak przy nieistniejacym zgloszeniu', () => {
    const matches = module.match(/no such report/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('notatka zamykajaca ladnie w watku, nie w osobnym polu', () => {
    expect(patch).toContain('postMessage({')
    expect(patch).toContain('reportId: report.id')
  })

  it('odpisywanie ma wlasny budzet', () => {
    const route = readFileSync('server/api/catalog/reports/[id]/thread.post.ts', 'utf8')
    expect(route).toContain('key: `report-thread:${user.id}`')
  })
})
