import { describe, expect, it } from 'vitest'
import { lightTheme, darkTheme } from '@iris-ui/tokens'
import { themeToCss } from './themeToCss'
import { themeCssVarEntries } from './applyTheme'

describe('themeToCss', () => {
  it('emits a :root rule by default with every token as a custom property', () => {
    const css = themeToCss(lightTheme)
    expect(css.startsWith(':root {')).toBe(true)
    expect(css.trimEnd().endsWith('}')).toBe(true)
    expect(css).toContain('--iris-background: #ffffff;')
    expect(css).toContain('--iris-gap-sm: 4px;') // spacing gets a px unit
    expect(css).toContain('--iris-radius-md: 6px;')
  })

  it('emits exactly one declaration per theme entry (no missing/extra)', () => {
    const entries = themeCssVarEntries(lightTheme)
    const css = themeToCss(lightTheme)
    const declarations = css.split('\n').filter((l) => l.trim().endsWith(';'))
    expect(declarations).toHaveLength(entries.length)
    // The static export matches the runtime entries exactly.
    for (const [name, value] of entries) {
      expect(css).toContain(`  ${name}: ${value};`)
    }
  })

  it('honors a custom selector for scoping a second theme', () => {
    const css = themeToCss(darkTheme, { selector: '[data-iris-theme="iris-dark"]' })
    expect(css.startsWith('[data-iris-theme="iris-dark"] {')).toBe(true)
    expect(css).toContain('--iris-background:')
  })
})
