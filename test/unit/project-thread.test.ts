import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ exec: vi.fn(), one: vi.fn(), q: vi.fn() }))

const { cleanBody, listComments, MAX_BODY } = await import('../../server/utils/project-thread')
const db = await import('../../server/utils/db')

function row(over: Record<string, unknown>) {
  return {
    id: 'c1',
    project_id: 'p1',
    author_id: 'u1',
    parent_id: null,
    body: 'tekst',
    hidden: false,
    created: 1,
    updated: null,
    a_id: 'u1',
    a_name: 'Ala',
    a_username: 'ala',
    a_image: null,
    ...over,
  }
}

describe('cleanBody', () => {
  it('przycina do limitu', () => {
    expect(cleanBody('x'.repeat(MAX_BODY + 50))).toHaveLength(MAX_BODY)
  })

  it('odrzuca pusty i sam bialy znak', () => {
    for (const bad of ['', '   ', '\n\t', null, undefined]) {
      expect(() => cleanBody(bad), String(bad)).toThrow()
    }
  })
})

describe('listComments', () => {
  it('wiesza odpowiedzi pod rodzicem, korzenie od najnowszych', async () => {
    vi.mocked(db.q).mockResolvedValue([
      row({ id: 'a', created: 1 }),
      row({ id: 'b', created: 2, parent_id: 'a' }),
      row({ id: 'c', created: 3 }),
    ] as never)

    const roots = await listComments('p1', false)

    expect(roots.map(r => r.id)).toEqual(['c', 'a'])
    expect(roots.find(r => r.id === 'a')!.replies.map(r => r.id)).toEqual(['b'])
  })

  // A hidden comment keeps its row so the replies under it survive, but its
  // text does not leave moderation.
  it('ukrywa tresc przed zwyklym czytelnikiem, pokazuje moderacji', async () => {
    const hidden = [row({ id: 'a', hidden: true, body: 'sekret' })] as never

    vi.mocked(db.q).mockResolvedValue(hidden)
    expect((await listComments('p1', false))[0]!.body).toBe('')

    vi.mocked(db.q).mockResolvedValue(hidden)
    expect((await listComments('p1', true))[0]!.body).toBe('sekret')
  })

  it('sierota po skasowanym rodzicu nie znika z listy', async () => {
    vi.mocked(db.q).mockResolvedValue([row({ id: 'b', parent_id: 'zniknal' })] as never)
    expect((await listComments('p1', false)).map(r => r.id)).toEqual(['b'])
  })
})
