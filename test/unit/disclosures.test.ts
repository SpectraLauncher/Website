import { describe, expect, it } from 'vitest'

import {
  DISCLOSURES,
  DISCLOSURE_KEYS,
  activeDisclosures,
  canAuthorEdit,
  canAuthorRemove,
  cleanDisclosures,
  isDisclosureKey,
  mergeAuthorEdit,
} from '../../shared/utils/disclosures'

describe('registry', () => {
  it('every disclosure has an icon', () => {
    for (const key of DISCLOSURE_KEYS) expect(DISCLOSURES[key].icon, key).toBeTruthy()
  })

  it('only known keys are accepted', () => {
    for (const key of DISCLOSURE_KEYS) expect(isDisclosureKey(key)).toBe(true)
    for (const bad of ['malware', '', null, 7]) expect(isDisclosureKey(bad), String(bad)).toBe(false)
  })
})

describe('cleanDisclosures', () => {
  it('drops unknown keys and unknown options', () => {
    const out = cleanDisclosures({
      ai_content: { note: 'x', options: ['code', 'nonsense'], lock: 'open' },
      invented: { note: 'y' },
    })

    expect(Object.keys(out)).toEqual(['ai_content'])
    expect(out.ai_content!.options).toEqual(['code'])
  })

  it('an unknown lock falls back to open rather than to locked', () => {
    const out = cleanDisclosures({ telemetry: { lock: 'whatever' } })
    expect(out.telemetry!.lock).toBe('open')
  })

  it('survives input that is not a map', () => {
    for (const bad of [null, 'x', 42, ['ai_content']]) {
      expect(cleanDisclosures(bad), String(bad)).toEqual({})
    }
  })

  it('trims a long note', () => {
    const out = cleanDisclosures({ advertisements: { note: 'a'.repeat(900) } })
    expect(out.advertisements!.note.length).toBeLessThanOrEqual(500)
  })
})

// The lock is the whole point: a moderator who established that a project does
// collect telemetry must be able to stop the author quietly unticking it.
describe('what a moderator pins, an author cannot move', () => {
  const locked = { telemetry: { note: 'phones home', options: [], lock: 'locked' as const } }
  const pinned = { telemetry: { note: 'phones home', options: [], lock: 'cannot_remove' as const } }

  it('a locked entry survives an edit that tries to change it', () => {
    const out = mergeAuthorEdit(locked, { telemetry: { note: 'nothing to see', options: [], lock: 'open' } })
    expect(out.telemetry).toEqual(locked.telemetry)
  })

  it('a locked entry survives an edit that drops it', () => {
    expect(mergeAuthorEdit(locked, {}).telemetry).toEqual(locked.telemetry)
  })

  it('cannot_remove lets the note change but not the entry vanish', () => {
    const edited = mergeAuthorEdit(pinned, { telemetry: { note: 'now with detail', options: [], lock: 'open' } })
    expect(edited.telemetry!.note).toBe('now with detail')

    expect(mergeAuthorEdit(pinned, {}).telemetry).toEqual(pinned.telemetry)
  })

  it('an author cannot raise the lock on their own entry', () => {
    const out = mergeAuthorEdit({}, { advertisements: { note: '', options: [], lock: 'locked' } })
    expect(out.advertisements!.lock).toBe('open')
  })

  it('an open entry can be added and removed freely', () => {
    const added = mergeAuthorEdit({}, { paid_features: { note: 'cosmetics', options: [], lock: 'open' } })
    expect(added.paid_features!.note).toBe('cosmetics')
    expect(mergeAuthorEdit(added, {})).toEqual({})
  })

  it('lock states answer the two questions separately', () => {
    expect(canAuthorEdit('open')).toBe(true)
    expect(canAuthorRemove('open')).toBe(true)

    expect(canAuthorEdit('cannot_remove')).toBe(true)
    expect(canAuthorRemove('cannot_remove')).toBe(false)

    expect(canAuthorEdit('locked')).toBe(false)
    expect(canAuthorRemove('locked')).toBe(false)
  })
})

describe('activeDisclosures', () => {
  it('lists what is set, in registry order', () => {
    const map = cleanDisclosures({ paid_features: {}, ai_content: {} })
    expect(activeDisclosures(map)).toEqual(['ai_content', 'paid_features'])
  })

  it('is empty for a project that declares nothing', () => {
    expect(activeDisclosures({})).toEqual([])
  })
})
