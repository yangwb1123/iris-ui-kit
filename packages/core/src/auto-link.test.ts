import { describe, expect, it } from 'vitest'
import { detectAutoLink } from './auto-link'

describe('detectAutoLink', () => {
  it('detects a plain https URL', () => {
    expect(detectAutoLink('https://example.com')).toBe('https://example.com')
  })

  it('detects an http URL with path/query/hash tail', () => {
    expect(detectAutoLink('http://example.com/a?b=1#c')).toBe('http://example.com/a?b=1#c')
  })

  it('is case-insensitive on the scheme', () => {
    expect(detectAutoLink('HTTP://EXAMPLE.COM')).toBe('HTTP://EXAMPLE.COM')
  })

  it('detects an email (byte-identical to mask EMAIL_RE)', () => {
    expect(detectAutoLink('user@example.com')).toBe('user@example.com')
  })

  it('returns null for plain text', () => {
    expect(detectAutoLink('hello world')).toBeNull()
  })

  it('returns null for a URL embedded mid-sentence (whole-text anchored)', () => {
    expect(detectAutoLink('Visit https://example.com now')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(detectAutoLink('')).toBeNull()
  })

  it('returns null for non-http(s) schemes and bare hosts', () => {
    expect(detectAutoLink('ftp://example.com')).toBeNull()
    expect(detectAutoLink('example.com')).toBeNull()
  })
})
