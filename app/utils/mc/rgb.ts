export interface Rgb { r: number, g: number, b: number }

export const toRgb = (color: number): Rgb => ({
  r: (color >> 16) & 0xFF,
  g: (color >> 8) & 0xFF,
  b: color & 0xFF
})

export const toInt = ({ r, g, b }: Rgb) => (r << 16) | (g << 8) | b

export const toHex = (color: number) =>
  '#' + (color & 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase()

export const fromHex = (hex: string) => parseInt(hex.replace('#', ''), 16) & 0xFFFFFF
