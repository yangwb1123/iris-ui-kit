/** Color conversion helpers. All channels normalized to 0..1 internally. */

export interface IrisHsva {
  h: number // 0..360
  s: number // 0..1
  v: number // 0..1
  a: number // 0..1
}

export interface IrisRgba {
  r: number // 0..255
  g: number // 0..255
  b: number // 0..255
  a: number // 0..1
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = (((h % 360) + 360) % 360) / 60
  const c = v * s
  const x = c * (1 - Math.abs((hh % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (hh < 1) [r, g, b] = [c, x, 0]
  else if (hh < 2) [r, g, b] = [x, c, 0]
  else if (hh < 3) [r, g, b] = [0, c, x]
  else if (hh < 4) [r, g, b] = [0, x, c]
  else if (hh < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rN = r / 255
  const gN = g / 255
  const bN = b / 255
  const max = Math.max(rN, gN, bN)
  const min = Math.min(rN, gN, bN)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rN) h = ((gN - bN) / d) % 6
    else if (max === gN) h = (bN - rN) / d + 2
    else h = (rN - gN) / d + 4
    h = h * 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

export function rgbToHex({ r, g, b, a }: IrisRgba): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  const rgb = `#${hex(r)}${hex(g)}${hex(b)}`
  if (a >= 1) return rgb
  return `${rgb}${hex(Math.round(a * 255))}`
}

/** Parse `#rgb`, `#rrggbb`, or `#rrggbbaa`. Returns null on parse failure. */
export function hexToRgba(input: string): IrisRgba | null {
  const m = input.trim().toLowerCase().match(/^#?([0-9a-f]{3,8})$/)
  if (!m) return null
  let s = m[1]!
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  if (s.length !== 6 && s.length !== 8) return null
  const r = parseInt(s.slice(0, 2), 16)
  const g = parseInt(s.slice(2, 4), 16)
  const b = parseInt(s.slice(4, 6), 16)
  const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1
  return { r, g, b, a }
}

export function rgbaToHsva(rgba: IrisRgba): IrisHsva {
  const { h, s, v } = rgbToHsv(rgba.r, rgba.g, rgba.b)
  return { h, s, v, a: rgba.a }
}

export function hsvaToRgba(hsva: IrisHsva): IrisRgba {
  const { r, g, b } = hsvToRgb(hsva.h, hsva.s, hsva.v)
  return { r, g, b, a: hsva.a }
}
