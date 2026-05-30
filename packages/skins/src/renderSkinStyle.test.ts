import { describe, it, expect } from 'vitest'
import { createSkinRegistry } from './registry'
import { builtinSkins } from './builtins'
import { renderSkinStyle, skinToCssEntries } from './renderSkinStyle'

describe('renderSkinStyle', () => {
  const reg = createSkinRegistry(builtinSkins)

  it('emits :root CSS with --iris- vars', () => {
    const css = renderSkinStyle(reg.resolve('light'))
    expect(css.startsWith(':root{')).toBe(true)
    expect(css).toContain('--iris-primary:')
    expect(css.endsWith('}')).toBe(true)
  })

  it('serializes custom tokens, numbers as px', () => {
    reg.register({ id: 'c', extends: 'light', custom: { 'brand.gap': 12, 'brand.font': 'Inter' } })
    const entries = skinToCssEntries(reg.resolve('c'))
    expect(entries).toContainEqual(['--brand-gap', '12px'])
    expect(entries).toContainEqual(['--brand-font', 'Inter'])
  })
})
