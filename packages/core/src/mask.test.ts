import { describe, expect, it } from 'vitest'
import { maskValue } from './mask'

describe('maskValue (batch AY, iris 独有)', () => {
  it('masks an email: local part masked (generic rule), domain kept verbatim', () => {
    expect(maskValue('alexandra@example.com', 'sensitive')).toBe('al****ra@example.com')
    // Short local part → wholesale `****` (nothing identifiable to keep).
    expect(maskValue('ab@example.com', 'sensitive')).toBe('****@example.com')
  })

  it('masks an 11-digit phone as 3 + **** + last 4 (CN mobile)', () => {
    expect(maskValue('13812345678', 'sensitive')).toBe('138****5678')
  })

  it('masks a generic ≥6-char string as first2 + **** + last2', () => {
    expect(maskValue('johnsmith', 'sensitive')).toBe('jo****th')
  })

  it('masks a short string wholesale', () => {
    expect(maskValue('ab', 'sensitive')).toBe('****')
    expect(maskValue('12345', 'sensitive')).toBe('****')
  })

  it('null / undefined / empty → empty string (export parity)', () => {
    expect(maskValue(null, 'sensitive')).toBe('')
    expect(maskValue(undefined, 'sensitive')).toBe('')
    expect(maskValue('', 'sensitive')).toBe('')
  })

  it('non-strings are string-coerced first, then masked', () => {
    // 11-digit number → phone mask.
    expect(maskValue(13812345678, 'sensitive')).toBe('138****5678')
    // 6-digit number → generic mask.
    expect(maskValue(123456, 'sensitive')).toBe('12****56')
  })

  it('an unknown kind passes the value through string-coerced (fail-open)', () => {
    // Cast needed: only `'sensitive'` is a public kind today.
    expect(maskValue('alexandra@example.com', 'other' as 'sensitive')).toBe('alexandra@example.com')
  })
})
