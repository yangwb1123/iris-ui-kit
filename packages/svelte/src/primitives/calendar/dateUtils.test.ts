import { describe, it, expect } from 'vitest'
import { safeLocale } from './dateUtils'

describe('safeLocale', () => {
  it('returns undefined for undefined (runtime default locale)', () => {
    expect(safeLocale(undefined)).toBeUndefined()
  })

  it('canonicalizes a valid BCP-47 tag', () => {
    expect(safeLocale('en-US')).toBe('en-US')
  })

  it.each(['bad locale!', 'en_US', '@@@'])(
    'returns without throwing for the malformed tag %j',
    (tag) => {
      expect(() => safeLocale(tag)).not.toThrow()
      // A malformed tag falls back to the runtime default (undefined).
      expect(safeLocale(tag)).toBeUndefined()
    },
  )

  it('never throws a RangeError the way raw Intl.DateTimeFormat would', () => {
    expect(() => new Intl.DateTimeFormat(safeLocale('bad locale!'))).not.toThrow()
  })
})
