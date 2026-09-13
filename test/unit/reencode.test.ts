import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

const { reencodeWebp } = await import('../../server/utils/reencode')

/**
 * A GIF89a written byte by byte, so the fixture cannot be the thing that is
 * wrong. sharp's own GIF encoder would not write a multi-frame file from a raw
 * strip on this build, which is exactly the sort of thing that makes a test
 * "prove" something it never tested.
 */
function animatedGif(frames: number): Buffer {
  const head = [
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    0x02, 0x00, 0x02, 0x00,
    0xF0, 0x00, 0x00,
    0xFF, 0x00, 0x00, 0x00, 0x00, 0xFF,
    0x21, 0xFF, 0x0B, 0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30,
    0x03, 0x01, 0x00, 0x00, 0x00,
  ]

  const frame = (colour: number) => [
    0x21, 0xF9, 0x04, 0x00, 0x32, 0x00, 0x00, 0x00,
    0x2C, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x02, 0x00, 0x00,
    0x02, 0x02, colour, 0x01, 0x00,
  ]

  const body = Array.from({ length: frames }, (_, i) => frame(i % 2 ? 0x8C : 0x44)).flat()
  return Buffer.from([...head, ...body, 0x3B])
}

const pagesOf = async (buffer: Buffer) =>
  (await sharp(buffer, { animated: true }).metadata()).pages ?? 1

describe('przekodowanie obrazu', () => {
  it('gif zostaje ruchomy — jako animowany webp', async () => {
    const out = await reencodeWebp(animatedGif(2), { size: 256, fit: 'cover', animated: true })
    const meta = await sharp(out, { animated: true }).metadata()

    expect(meta.format).toBe('webp')
    expect(meta.pages).toBe(2)
  })

  // An avatar or a badge has no reason to move, and a moving one is a cost
  // paid on every page that shows it.
  it('tam, gdzie animacja nie jest chciana, zostaje jedna klatka', async () => {
    const out = await reencodeWebp(animatedGif(4), { size: 256, fit: 'cover' })

    expect(await pagesOf(out)).toBe(1)
  })

  it('nic nie wychodzi w formacie, w ktorym weszlo', async () => {
    const out = await reencodeWebp(animatedGif(2), { size: 64, fit: 'cover', animated: true })

    // never the original bytes: a file crafted against a decoder must not reach
    // anybody else's browser
    expect((await sharp(out).metadata()).format).toBe('webp')
    expect(out.equals(animatedGif(2))).toBe(false)
  })

  // A few hundred kilobytes of GIF can decode to gigabytes of frames.
  it('za dluga animacja jest odrzucana, nie przetwarzana', async () => {
    await expect(reencodeWebp(animatedGif(400), { size: 256, fit: 'cover', animated: true }))
      .rejects.toThrow(/frames/)
  })

  it('to, co nie jest obrazkiem, nie przechodzi', async () => {
    await expect(reencodeWebp(Buffer.from('nie obrazek'), { size: 64, fit: 'cover' }))
      .rejects.toThrow()
  })
})
