import { describe, it, expect } from 'vitest'
import { clamp01, hsvToRgb, rgbToHsv, rgbToHex, hexToRgba, rgbaToHsva, hsvaToRgba } from './color'

describe('clamp01', () => {
  it('clamps to 0..1', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(0.5)).toBe(0.5)
  })
})

describe('hsvToRgb / rgbToHsv round-trip', () => {
  it('primary colors', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual({ r: 255, g: 0, b: 0 })
    expect(hsvToRgb(120, 1, 1)).toEqual({ r: 0, g: 255, b: 0 })
    expect(hsvToRgb(240, 1, 1)).toEqual({ r: 0, g: 0, b: 255 })
  })
  it('rgbToHsv recovers hue/sat/val', () => {
    const { h, s, v } = rgbToHsv(255, 0, 0)
    expect(h).toBe(0)
    expect(s).toBe(1)
    expect(v).toBe(1)
  })
  it('grayscale has zero saturation', () => {
    expect(rgbToHsv(128, 128, 128).s).toBe(0)
  })
})

describe('rgbToHex / hexToRgba', () => {
  it('serializes without alpha when opaque', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0, a: 1 })).toBe('#ff0000')
  })
  it('appends alpha when translucent', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080')
  })
  it('parses #rgb, #rrggbb, #rrggbbaa', () => {
    expect(hexToRgba('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    expect(hexToRgba('#00ff00')).toEqual({ r: 0, g: 255, b: 0, a: 1 })
    expect(hexToRgba('#0000ff80')?.a).toBeCloseTo(0.5, 1)
  })
  it('returns null on garbage', () => {
    expect(hexToRgba('nope')).toBeNull()
    expect(hexToRgba('#12')).toBeNull()
  })
})

describe('rgbaToHsva / hsvaToRgba', () => {
  it('preserves alpha through the bundle conversions', () => {
    const hsva = rgbaToHsva({ r: 255, g: 0, b: 0, a: 0.3 })
    expect(hsva.a).toBe(0.3)
    const rgba = hsvaToRgba(hsva)
    expect(rgba).toEqual({ r: 255, g: 0, b: 0, a: 0.3 })
  })
})
