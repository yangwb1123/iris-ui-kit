import { describe, expect, it } from 'vitest'
import { safeLocale } from './dateUtils'

describe('safeLocale', () => {
  it('returns undefined for undefined (runtime default locale)', () => {
    expect(safeLocale(undefined)).toBeUndefined()
  })

  it('passes a valid BCP-47 tag through canonicalized', () => {
    expect(safeLocale('en-US')).toBe('en-US')
  })

  it.each(['bad locale!', 'en_US', '@@@'])(
    'falls back to undefined for the malformed tag %j without throwing',
    (tag) => {
      let result: string | undefined
      expect(() => {
        result = safeLocale(tag)
      }).not.toThrow()
      expect(result).toBeUndefined()
    },
  )

  it('a malformed tag never throws when fed to Intl.DateTimeFormat', () => {
    expect(
      () => new Intl.DateTimeFormat(safeLocale('bad locale!'), { dateStyle: 'medium' }),
    ).not.toThrow()
  })
})
