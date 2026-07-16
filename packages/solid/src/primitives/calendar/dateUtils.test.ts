import { describe, it, expect } from 'vitest'
import { safeLocale } from './dateUtils'

describe('safeLocale', () => {
  it('returns undefined for undefined (runtime default locale)', () => {
    expect(safeLocale(undefined)).toBeUndefined()
  })

  it('passes a valid BCP-47 tag through', () => {
    expect(safeLocale('en-US')).toBe('en-US')
  })

  it.each(['bad locale!', 'en_US', '@@@'])(
    'does not throw and falls back to undefined for malformed tag %j',
    (tag) => {
      let result: string | undefined
      expect(() => {
        result = safeLocale(tag)
      }).not.toThrow()
      expect(result).toBeUndefined()
    },
  )

  it('the returned value is always safe for Intl.DateTimeFormat', () => {
    for (const tag of [undefined, 'en-US', 'bad locale!', 'en_US', '@@@']) {
      expect(() => new Intl.DateTimeFormat(safeLocale(tag), { dateStyle: 'medium' })).not.toThrow()
    }
  })
})
