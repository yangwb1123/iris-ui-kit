import { describe, it, expect } from 'vitest'
import { lightTheme, darkTheme } from './index'
import { ALL_TOKEN_NAMES, COLOR_TOKENS, SPACING_TOKENS, RADII_TOKENS } from './tokens'

describe('lightTheme', () => {
  it('has all required color tokens', () => {
    for (const token of COLOR_TOKENS) {
      expect(lightTheme.colors).toHaveProperty(token)
    }
  })

  it('has all required spacing tokens', () => {
    for (const token of SPACING_TOKENS) {
      expect(lightTheme.spacing).toHaveProperty(token)
    }
  })

  it('has all required radii tokens', () => {
    for (const token of RADII_TOKENS) {
      expect(lightTheme.radii).toHaveProperty(token)
    }
  })

  it('has name and type', () => {
    expect(lightTheme.name).toBe('iris-light')
    expect(lightTheme.type).toBe('light')
  })

  it('all color values are non-empty strings', () => {
    for (const value of Object.values(lightTheme.colors)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })
})

describe('darkTheme', () => {
  it('has all required color tokens', () => {
    for (const token of COLOR_TOKENS) {
      expect(darkTheme.colors).toHaveProperty(token)
    }
  })

  it('has all required spacing tokens', () => {
    for (const token of SPACING_TOKENS) {
      expect(darkTheme.spacing).toHaveProperty(token)
    }
  })

  it('has name and type', () => {
    expect(darkTheme.name).toBe('iris-dark')
    expect(darkTheme.type).toBe('dark')
  })

  it('dark colors differ from light', () => {
    expect(darkTheme.colors['iris.background']).not.toBe(lightTheme.colors['iris.background'])
  })

  it('all color values are non-empty strings', () => {
    for (const value of Object.values(darkTheme.colors)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })
})

describe('theme token lists', () => {
  it('ALL_TOKEN_NAMES includes all token categories', () => {
    expect(ALL_TOKEN_NAMES.length).toBe(
      COLOR_TOKENS.length + SPACING_TOKENS.length + RADII_TOKENS.length + 3 + 8 + 5,
    )
  })
})
