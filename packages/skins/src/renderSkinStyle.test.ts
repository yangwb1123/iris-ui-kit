import { describe, it, expect } from 'vitest'
import { createSkinRegistry } from './registry'
import { builtinSkins } from './builtins'
import { renderSkinStyle, skinToCssEntries } from './renderSkinStyle'
import type { ResolvedSkin } from './types'

describe('renderSkinStyle', () => {
  const reg = createSkinRegistry(builtinSkins)

  it('emits :root CSS with --iris- vars', () => {
    const css = renderSkinStyle(reg.resolve('light'))
    expect(css.startsWith(':root{')).toBe(true)
    expect(css).toContain('--iris-primary:')
    expect(css).toContain('--iris-shadow-sm:')
    expect(css).toContain('--iris-z-toast:')
    expect(css).toContain('--iris-transition-fast:')
    expect(css.endsWith('}')).toBe(true)
  })

  it('serializes inherited overrides for shadows, z-index and transitions', () => {
    reg.register({
      id: 'full-theme',
      extends: 'light',
      tokens: {
        'iris.shadow.md': '0 8px 16px rgb(0 0 0 / 0.2)',
        'iris.z.modal': 4096,
        'iris.transition.normal': '180ms',
      },
    })
    const entries = skinToCssEntries(reg.resolve('full-theme'))
    expect(entries).toContainEqual(['--iris-shadow-md', '0 8px 16px rgb(0 0 0 / 0.2)'])
    expect(entries).toContainEqual(['--iris-z-modal', '4096'])
    expect(entries).toContainEqual(['--iris-transition-normal', '180ms'])
  })

  it('serializes custom tokens, numbers as px', () => {
    reg.register({ id: 'c', extends: 'light', custom: { 'brand.gap': 12, 'brand.font': 'Inter' } })
    const entries = skinToCssEntries(reg.resolve('c'))
    expect(entries).toContainEqual(['--brand-gap', '12px'])
    expect(entries).toContainEqual(['--brand-font', 'Inter'])
  })

  it('sanitizes custom values that would break out of the rule or <style>', () => {
    reg.register({
      id: 'evil-val',
      extends: 'light',
      custom: { 'brand.x': 'red}</style><script>alert(1)</script>' },
    })
    const css = renderSkinStyle(reg.resolve('evil-val'))
    // No angle brackets (so no </style> / <script> breakout) and the rule stays
    // a single well-formed block (no injected `}` mid-value).
    expect(css).not.toMatch(/[<>]/)
    expect(css).toMatch(/^:root\{[^{}]*\}$/)
    expect(css).toContain('--brand-x:red')
  })

  it('drops custom entries whose key would inject a second declaration', () => {
    // Defense-in-depth: even if a malformed custom key reaches a ResolvedSkin
    // (validateSkin also rejects these upstream), it must not be emitted.
    const resolved = {
      theme: { colors: {}, spacing: {}, radii: {} },
      custom: { 'brand.y;color:red': 'blue', 'brand.ok': 'green' },
    } as unknown as ResolvedSkin
    const entries = skinToCssEntries(resolved)
    expect(entries.some(([n]) => n.includes(';'))).toBe(false)
    expect(entries).toContainEqual(['--brand-ok', 'green'])
  })

  it('preserves legitimate CSS values (calc, url, rgba, shadows)', () => {
    reg.register({
      id: 'legit',
      extends: 'light',
      custom: {
        'brand.w': 'calc(100% - 8px)',
        'brand.shadow': '0 1px 2px rgba(0,0,0,.1)',
      },
    })
    const entries = skinToCssEntries(reg.resolve('legit'))
    expect(entries).toContainEqual(['--brand-w', 'calc(100% - 8px)'])
    expect(entries).toContainEqual(['--brand-shadow', '0 1px 2px rgba(0,0,0,.1)'])
  })
})
