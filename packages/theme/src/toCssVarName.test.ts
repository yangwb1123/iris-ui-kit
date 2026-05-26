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
})

describe('getCssVar', () => {
  it('wraps a token in var()', () => {
    expect(getCssVar('iris.primary')).toBe('var(--iris-primary)')
  })

  it('includes a fallback when provided', () => {
    expect(getCssVar('iris.primary', '#000')).toBe('var(--iris-primary, #000)')
  })
})
