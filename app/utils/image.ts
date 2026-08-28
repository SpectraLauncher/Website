export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function toSquareWebp(file: File, size = 256, mode: 'cover' | 'contain' = 'cover'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size

      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no canvas'))

      if (mode === 'cover') {
        const side = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      }
      else {
        const scale = Math.min(size / img.width, size / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      }

      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/webp', 0.9)
      URL.revokeObjectURL(img.src)
    }

    img.onerror = () => reject(new Error('not an image'))
    img.src = URL.createObjectURL(file)
  })
}
