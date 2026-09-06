import { describe, expect, it } from 'vitest'

import { NOTIFICATION_ICONS } from '../../app/composables/useNotifications'
import {
  DEFAULT_PREFS,
  NOTIFICATION_GROUPS,
  NOTIFICATION_GROUP_KEYS,
  cleanPrefs,
  groupOf,
  wantsEmail,
} from '../../shared/utils/notification-prefs'

describe('grupy powiadomien', () => {
  // A kind with no group cannot be configured, so its mail cannot be turned off.
  it('kazdy rodzaj powiadomienia nalezy do jakiejs grupy', () => {
    for (const kind of Object.keys(NOTIFICATION_ICONS)) {
      expect(groupOf(kind), kind).not.toBeNull()
    }
  })

  it('zaden rodzaj nie siedzi w dwoch grupach', () => {
    const all = NOTIFICATION_GROUP_KEYS.flatMap(g => [...NOTIFICATION_GROUPS[g]])
    expect(new Set(all).size).toBe(all.length)
  })

  it('kazda grupa ma domyslne ustawienie', () => {
    for (const group of NOTIFICATION_GROUP_KEYS) expect(DEFAULT_PREFS[group]).toBeTruthy()
  })
})

describe('cleanPrefs', () => {
  it('brak zapisu daje domyslne', () => {
    expect(cleanPrefs(null)).toEqual(DEFAULT_PREFS)
    expect(cleanPrefs('nie obiekt')).toEqual(DEFAULT_PREFS)
  })

  // The bell is the record of what happened. Turning it off would leave someone
  // with no trace of a moderation decision.
  it('site zostaje nawet gdy ktos go wytnie', () => {
    expect(cleanPrefs({ social: [] }).social).toEqual(['site'])
    expect(cleanPrefs({ social: ['email'] }).social).toEqual(['site', 'email'])
  })

  it('nieznane kanaly odpadaja', () => {
    expect(cleanPrefs({ social: ['sms', 'email'] }).social).toEqual(['site', 'email'])
  })

  it('nie duplikuje kanalu', () => {
    expect(cleanPrefs({ social: ['site', 'site', 'email'] }).social).toEqual(['site', 'email'])
  })
})

describe('wantsEmail', () => {
  it('domyslnie mail idzie tylko o wlasnych projektach', () => {
    const prefs = cleanPrefs(null)
    expect(wantsEmail(prefs, 'project_rejected')).toBe(true)
    expect(wantsEmail(prefs, 'friend_request')).toBe(false)
    expect(wantsEmail(prefs, 'project_comment')).toBe(false)
  })

  it('da sie wlaczyc i wylaczyc', () => {
    expect(wantsEmail(cleanPrefs({ comments: ['email'] }), 'project_comment')).toBe(true)
    expect(wantsEmail(cleanPrefs({ projects: [] }), 'project_rejected')).toBe(false)
  })

  it('nieznany rodzaj nie wysyla maila', () => {
    expect(wantsEmail(cleanPrefs(null), 'cokolwiek')).toBe(false)
  })
})
