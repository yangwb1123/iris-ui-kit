import { describe, it, expect } from 'vitest'
import { skinBootScript } from './bootScript'

describe('skinBootScript', () => {
  it('returns an IIFE string embedding the styles + fallback', () => {
    const script = skinBootScript({
      storageKey: 'iris-skin',
      styles: { light: ':root{--iris-primary:#000}' },
      fallbackId: 'light',
    })
    expect(script).toContain('iris-skin')
    expect(script).toContain('--iris-primary')
    expect(script).toContain('localStorage')
    expect(script.trim().startsWith('(function')).toBe(true)
  })

  it('includes the nonce attribute when configured', () => {
    const script = skinBootScript({
      storageKey: 'iris-skin',
      styles: { light: ':root{--iris-primary:#000}' },
      fallbackId: 'light',
      nonce: 'abc123',
    })
    expect(script).toContain('nonce')
    expect(script).toContain('abc123')
  })
})
