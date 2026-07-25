import { describe, expect, it } from 'vitest'
import { getCssVar } from './getCssVar'

describe('getCssVar', () => {
  it('wraps a token in var()', () => {
    expect(getCssVar('iris.primary')).toBe('var(--iris-primary)')
  })

  it('handles multi-segment tokens', () => {
    expect(getCssVar('iris.font.family')).toBe('var(--iris-font-family)')
  })

  it('includes fallback when provided', () => {
    expect(getCssVar('iris.custom', '#000')).toBe('var(--iris-custom, #000)')
  })

  it('handles fallback with spaces', () => {
    expect(getCssVar('iris.font', 'Inter, sans-serif')).toBe('var(--iris-font, Inter, sans-serif)')
  })

  it('handles numeric tokens', () => {
    expect(getCssVar('iris.z.modal')).toBe('var(--iris-z-modal)')
  })

  it('handles dashed tokens correctly', () => {
    expect(getCssVar('iris.surface.hover')).toBe('var(--iris-surface-hover)')
  })
})
