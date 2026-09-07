import { describe, expect, it } from 'vitest'

import {
  ACCOUNTS_API_VERSION,
  TRANSFER_COUNTRIES,
  canReceive,
  canReceiveTransfers,
  readAccountState,
  recipientAccountParams,
} from '../../server/utils/connect'

const params = recipientAccountParams({ email: 'a@example.com', country: 'PL' })

// This object is the whole agreement about who verifies whom and who carries a
// loss, so it is asserted as a value rather than trusted to a live call.
describe('parametry konta odbiorcy', () => {
  it('prosi o recipient, nigdy o merchant', () => {
    expect(params.configuration?.recipient).toBeTruthy()
    expect(params.configuration).not.toHaveProperty('merchant')
  })

  // Nothing is ever charged on a connected account here: the buyer pays the
  // platform and the platform transfers onwards.
  it('jedyna zamawiana zdolnosc to przyjmowanie transferow', () => {
    const balance = params.configuration?.recipient?.capabilities?.stripe_balance
    expect(balance?.stripe_transfers).toEqual({ requested: true })
    expect(Object.keys(balance ?? {})).toEqual(['stripe_transfers'])
  })

  // Required by Stripe whenever stripe_transfers is requested. It is also what
  // keeps requirement collection on Stripe: the platform only inherits KYC when
  // losses sit on the application AND the dashboard is 'none'. Since the losses
  // half is forced below, this value is the only thing standing between us and
  // collecting identity documents ourselves.
  it('dashboard nie jest none, bo to on zostawia KYC po stronie Stripe', () => {
    expect(params.dashboard).toBe('express')
    expect(params.dashboard).not.toBe('none')
  })

  // Stripe rejects the account outright otherwise: "Losses collector can only be
  // 'application' for the set of configurations this account has." Found in
  // production, not in the documentation.
  it('obie odpowiedzialnosci sa na aplikacji, bo recipient nie przyjmuje innych', () => {
    expect(params.defaults?.responsibilities).toEqual({
      fees_collector: 'application',
      losses_collector: 'application',
    })
  })

  it('waluta konta to euro, kraj idzie malymi literami', () => {
    expect(params.defaults?.currency).toBe('eur')
    expect(params.identity?.country).toBe('pl')
  })

  it('prosi o pola potrzebne do pokazania stanu weryfikacji', () => {
    expect(params.include).toContain('requirements')
    expect(params.include).toContain('configuration.recipient')
  })

  it('adres kontaktowy jest wymagany przy tej konfiguracji', () => {
    expect(params.contact_email).toBe('a@example.com')
  })
})

describe('kraje, do ktorych da sie przelac', () => {
  it('obejmuja EOG, Wielka Brytanie, Szwajcarie, USA i Kanade', () => {
    for (const country of ['PL', 'DE', 'NO', 'GB', 'CH', 'US', 'CA']) {
      expect(canReceiveTransfers(country), country).toBe(true)
    }
  })

  // An account verified in one of these would pass onboarding and then be
  // impossible to pay, which is worse than refusing at the start.
  it('nie obejmuja reszty swiata', () => {
    for (const country of ['JP', 'BR', 'AU', 'SG', 'IN']) {
      expect(canReceiveTransfers(country), country).toBe(false)
    }
  })

  it('znosza wielkosc liter i pustke', () => {
    expect(canReceiveTransfers('pl')).toBe(true)
    expect(canReceiveTransfers(null)).toBe(false)
    expect(canReceiveTransfers(undefined)).toBe(false)
    expect(canReceiveTransfers('')).toBe(false)
  })

  it('lista nie ma duplikatow', () => {
    expect(new Set(TRANSFER_COUNTRIES).size).toBe(TRANSFER_COUNTRIES.length)
  })
})

describe('odczyt stanu konta z odpowiedzi v2', () => {
  const account = (over: Record<string, unknown> = {}) => ({
    id: 'acct_1',
    identity: { country: 'pl' },
    configuration: {
      recipient: {
        applied: true,
        capabilities: {
          stripe_balance: {
            stripe_transfers: { status: 'active', status_details: [] },
            payouts: { status: 'restricted', status_details: [] },
          },
        },
      },
    },
    requirements: { entries: [] },
    ...over,
  } as never)

  it('czyta obie zdolnosci osobno', () => {
    const state = readAccountState(account())
    expect(state.transfersEnabled).toBe(true)
    expect(state.payoutsEnabled).toBe(false)
    expect(state.country).toBe('pl')
  })

  // Requirements Stripe is itself working through are not a to-do list for the
  // seller; showing them invites re-uploading documents already under review.
  it('do zrobienia sa tylko wymogi czekajace na uzytkownika', () => {
    const state = readAccountState(account({
      requirements: {
        entries: [
          { awaiting_action_from: 'user', description: 'individual.id_number' },
          { awaiting_action_from: 'stripe', description: 'individual.verification' },
        ],
      },
    }))

    expect(state.due).toEqual(['individual.id_number'])
    expect(state.detailsSubmitted).toBe(false)
  })

  it('brak wymogow po stronie uzytkownika to komplet dokumentow', () => {
    expect(readAccountState(account()).detailsSubmitted).toBe(true)
  })

  // Stripe can be still reviewing what was handed over, so a complete set of
  // documents is not the same as being able to receive money.
  it('komplet dokumentow to nie to samo co mozliwosc przyjmowania pieniedzy', () => {
    const state = readAccountState(account({
      configuration: {
        recipient: {
          applied: true,
          capabilities: {
            stripe_balance: { stripe_transfers: { status: 'pending', status_details: [] } },
          },
        },
      },
    }))

    expect(state.detailsSubmitted).toBe(true)
    expect(state.transfersEnabled).toBe(false)
  })

  it('znosi odpowiedz bez konfiguracji', () => {
    const state = readAccountState({ id: 'acct_1' } as never)
    expect(state).toMatchObject({ transfersEnabled: false, payoutsEnabled: false, country: null })
  })
})

describe('mozliwosc przyjecia transferu', () => {
  const row = (over: Record<string, unknown>) => ({ transfers_enabled: false, ...over } as never)

  it('zalezy wylacznie od zdolnosci transferowej', () => {
    expect(canReceive(row({ transfers_enabled: true }))).toBe(true)
    expect(canReceive(row({ transfers_enabled: false, payouts_enabled: true }))).toBe(false)
  })

  // Deferred onboarding: somebody can be owed money with no Stripe account at
  // all, so this has to answer for a row that is not there.
  it('brak konta to po prostu nie', () => {
    expect(canReceive(undefined)).toBe(false)
  })
})

describe('wersja API', () => {
  // Accounts v2 answers only to a dated preview version, and a preview version
  // may change in ways a released one may not. One constant, one place to bump.
  it('jest przypieta do wersji preview', () => {
    expect(ACCOUNTS_API_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.preview$/)
  })
})
