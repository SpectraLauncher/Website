import { describe, expect, it } from 'vitest'

process.env.BETTER_AUTH_SECRET ||= 'upload-signature-test'

const { checkUpload, signUpload } = await import('../../server/utils/content-store')

const file = {
  filename: 'sodium-0.5.8.jar',
  size: 1234,
  sha1: 'a'.repeat(40),
  sha512: 'b'.repeat(128),
  key: 'content/bb/sodium-0.5.8.jar',
}

// sha512 is checked against the stored object, but sha1 cannot be without
// reading the file back — and a caller free to choose its own sha1 can store a
// file no launcher will ever match by hash.
describe('podpis wgranego pliku', () => {
  it('przepuszcza to, co sam podpisal', () => {
    expect(checkUpload(file, signUpload(file))).toBe(true)
  })

  it('odrzuca zmieniony kazdy z pol', () => {
    const token = signUpload(file)

    expect(checkUpload({ ...file, sha1: 'c'.repeat(40) }, token)).toBe(false)
    expect(checkUpload({ ...file, sha512: 'd'.repeat(128) }, token)).toBe(false)
    expect(checkUpload({ ...file, size: 9999 }, token)).toBe(false)
    expect(checkUpload({ ...file, filename: 'other.jar' }, token)).toBe(false)
  })

  it('odrzuca smieci zamiast podpisu', () => {
    expect(checkUpload(file, '')).toBe(false)
    expect(checkUpload(file, 'nonsense')).toBe(false)
    expect(checkUpload(file, signUpload(file).slice(0, -2))).toBe(false)
  })
})
