import { CAPE_RECT, LEGACY_COPIES, SKIN_SIZE, capeScale, isLegacySkin, stripLegacyHat } from './skin.ts'

export function skinToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SKIN_SIZE
  canvas.height = SKIN_SIZE

  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)

  if (!isLegacySkin(image.width, image.height)) return canvas

  for (const copy of LEGACY_COPIES) {
    const patch = document.createElement('canvas')
    patch.width = copy.from.w
    patch.height = copy.from.h

    const pctx = patch.getContext('2d')!
    pctx.translate(copy.from.w, 0)
    pctx.scale(-1, 1)
    pctx.drawImage(image, copy.from.x, copy.from.y, copy.from.w, copy.from.h, 0, 0, copy.from.w, copy.from.h)

    ctx.drawImage(patch, copy.to[0], copy.to[1])
  }

  const data = ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE)
  if (stripLegacyHat(data.data, SKIN_SIZE)) ctx.putImageData(data, 0, 0)

  return canvas
}

export const loadSkinCanvas = (url: string) => new Promise<HTMLCanvasElement>((resolve, reject) => {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => resolve(skinToCanvas(image))
  image.onerror = () => reject(new Error('skin load failed'))
  image.src = url
})

export const loadPlainCanvas = (url: string) => new Promise<HTMLCanvasElement>((resolve, reject) => {
  const image = new Image()
  image.crossOrigin = 'anonymous'

  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    canvas.getContext('2d')!.drawImage(image, 0, 0)
    resolve(canvas)
  }

  image.onerror = () => reject(new Error('cape load failed'))
  image.src = url
})

export function capeFrontCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const scale = capeScale(image.width, image.height)
  const { x, y, w, h } = CAPE_RECT

  const canvas = document.createElement('canvas')
  canvas.width = w * scale
  canvas.height = h * scale

  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, x * scale, y * scale, w * scale, h * scale, 0, 0, canvas.width, canvas.height)

  return canvas
}

export const loadCapeFront = (url: string) => new Promise<string>((resolve, reject) => {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => resolve(capeFrontCanvas(image).toDataURL())
  image.onerror = () => reject(new Error('cape load failed'))
  image.src = url
})
