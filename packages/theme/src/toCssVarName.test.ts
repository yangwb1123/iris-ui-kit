import { describe, expect, it } from 'vitest'
import { toCssVarName } from './toCssVarName'
import { getCssVar } from './getCssVar'

describe('toCssVarName', () => {
  it('converts single-segment dot keys', () => {
    expect(toCssVarName('iris.background')).toBe('--iris-background')
  })

  it('converts nested dot keys', () => {
    expect(toCssVarName('iris.gap.md')).toBe('--iris-gap-md')
  })

  it('handles keys with no dots', () => {
    expect(toCssVarName('iris')).toBe('--iris')
  })

  it('handles multi-segment keys with hyphens', () => {
    expect(toCssVarName('iris.surface.hover')).toBe('--iris-surface-hover')
  })

  it('handles keys with numbers', () => {
    expect(toCssVarName('iris.z.modal')).toBe('--iris-z-modal')
    expect(toCssVarName('iris.gap.2xl')).toBe('--iris-gap-2xl')
  })

  it('handles single segment without prefix', () => {
    expect(toCssVarName('background')).toBe('--background')
  })

  it('preserves existing dashes', () => {
    expect(toCssVarName('iris.ui-scale')).toBe('--iris-ui-scale')
  })

  it('handles empty string', () => {
    expect(toCssVarName('')).toBe('--')
  })

  it('handles trailing dot', () => {
    expect(toCssVarName('iris.')).toBe('--iris-')
  })
})

describe('getCssVar', () => {
  it('wraps a token in var()', () => {
    expect(getCssVar('iris.primary')).toBe('var(--iris-primary)')
  })

  it('includes a fallback when provided', () => {
    expect(getCssVar('iris.primary', '#000')).toBe('var(--iris-primary, #000)')
  })
})
