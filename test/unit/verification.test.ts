import { describe, expect, it } from 'vitest'

import {
  VERIFICATION_KINDS,
  isVerificationKind,
} from '../../server/utils/verification'

describe('rodzaje wnioskow', () => {
  it('sa dokladnie dwa i oba rozpoznawane', () => {
    expect(VERIFICATION_KINDS).toEqual(['partner', 'organization'])
    for (const kind of VERIFICATION_KINDS) expect(isVerificationKind(kind)).toBe(true)
  })

  it('nic innego nie przechodzi', () => {
    for (const value of ['admin', 'verified', '', null, 1, {}]) {
      expect(isVerificationKind(value), JSON.stringify(value)).toBe(false)
    }
  })
})
