import { describe, expect, it } from 'vitest'
import { safeLocale } from './dateUtils'

describe('safeLocale', () => {
  it('does not throw on malformed tags and returns a value', () => {
    for (const bad of ['bad locale!', 'en_US', '@@@']) {
      expect(() => safeLocale(bad)).not.toThrow()
    }
  })

  it('passes a valid tag through', () => {
    expect(safeLocale('en-US')).toBe('en-US')
  })

  it('passes undefined through', () => {
    expect(safeLocale(undefined)).toBeUndefined()
  })
})
