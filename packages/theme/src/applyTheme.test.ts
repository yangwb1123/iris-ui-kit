import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'
import { applyTheme } from './applyTheme'

describe('applyTheme', () => {
  let target: HTMLElement

  beforeEach(() => {
    target = document.createElement('div')
    document.body.appendChild(target)
  })

  afterEach(() => {
    target.remove()
  })

  it('writes color tokens as inline CSS custom properties', () => {
    applyTheme(lightTheme, target)
    expect(target.style.getPropertyValue('--iris-background')).toBe(
      lightTheme.colors['iris.background'],
    )
    expect(target.style.getPropertyValue('--iris-primary')).toBe(lightTheme.colors['iris.primary'])
  })

  it('derives a precomputed --iris-{semantic}-subtle for the color-mix fallback', () => {
    applyTheme(lightTheme, target)
    // danger composited ~14% over the white background → a light-red tint that
    // is a valid hex everywhere (the static fallback under color-mix()).
    const subtle = target.style.getPropertyValue('--iris-danger-subtle')
    expect(subtle).toMatch(/^#[0-9a-f]{6}$/i)
    expect(subtle).not.toBe(lightTheme.colors['iris.danger'])
    // present for every semantic source.
    for (const name of ['primary', 'success', 'warning', 'danger', 'muted']) {
      expect(target.style.getPropertyValue(`--iris-${name}-subtle`)).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('writes spacing tokens with px units', () => {
    applyTheme(lightTheme, target)
    expect(target.style.getPropertyValue('--iris-gap-md')).toBe(
      `${lightTheme.spacing['iris.gap.md']}px`,
    )
  })

  it('writes radii tokens with px units', () => {
    applyTheme(lightTheme, target)
    expect(target.style.getPropertyValue('--iris-radius-md')).toBe(
      `${lightTheme.radii['iris.radius.md']}px`,
    )
  })

  it('sets data-iris-theme and data-iris-theme-type attributes', () => {
    applyTheme(darkTheme, target)
    expect(target.getAttribute('data-iris-theme')).toBe('iris-dark')
    expect(target.getAttribute('data-iris-theme-type')).toBe('dark')
  })

  it('revert restores prior CSS variable values', () => {
    target.style.setProperty('--iris-background', '#cafebabe')
    const { revert } = applyTheme(lightTheme, target)
    expect(target.style.getPropertyValue('--iris-background')).toBe(
      lightTheme.colors['iris.background'],
    )
    revert()
    expect(target.style.getPropertyValue('--iris-background')).toBe('#cafebabe')
  })

  it('revert removes properties that had no prior value', () => {
    const { revert } = applyTheme(lightTheme, target)
    expect(target.style.getPropertyValue('--iris-primary')).not.toBe('')
    revert()
    expect(target.style.getPropertyValue('--iris-primary')).toBe('')
  })

  it('revert restores prior data attributes', () => {
    target.setAttribute('data-iris-theme', 'previous')
    target.setAttribute('data-iris-theme-type', 'light')
    const { revert } = applyTheme(darkTheme, target)
    expect(target.getAttribute('data-iris-theme')).toBe('iris-dark')
    revert()
    expect(target.getAttribute('data-iris-theme')).toBe('previous')
    expect(target.getAttribute('data-iris-theme-type')).toBe('light')
  })

  it('revert removes data attributes when none existed before', () => {
    const { revert } = applyTheme(darkTheme, target)
    expect(target.hasAttribute('data-iris-theme')).toBe(true)
    revert()
    expect(target.hasAttribute('data-iris-theme')).toBe(false)
    expect(target.hasAttribute('data-iris-theme-type')).toBe(false)
  })
})
