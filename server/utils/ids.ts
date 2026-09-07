import { randomBytes } from 'node:crypto'

import { ID_LENGTH } from '../../shared/utils/ids'

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function newId(): string {
  let out = ''

  while (out.length < ID_LENGTH) {
    // Rejection sampling: 256 is not a multiple of 62, so taking the remainder
    // of every byte would make the first few characters slightly more likely.
    for (const byte of randomBytes(ID_LENGTH * 2)) {
      if (byte >= 248) continue
      out += ALPHABET[byte % 62]
      if (out.length === ID_LENGTH) break
    }
  }

  return out
}
