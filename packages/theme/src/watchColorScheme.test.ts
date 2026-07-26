import { afterEach, describe, expect, it, vi } from 'vitest'
import { getColorScheme, watchColorScheme } from './watchColorScheme'

type Handler = (event: { matches: boolean }) => void

/** Install a controllable `window.matchMedia` mock; returns a scheme toggler. */
function mockMatchMedia(initialDark: boolean) {
  const listeners = new Set<Handler>()
  const mql = {
    matches: initialDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type: string, cb: Handler) => listeners.add(cb),
    removeEventListener: (_type: string, cb: Handler) => listeners.delete(cb),
    addListener: (cb: Handler) => listeners.add(cb),
    removeListener: (cb: Handler) => listeners.delete(cb),
  }
  ;(window as unknown as { matchMedia: unknown }).matchMedia = vi.fn(() => mql)
  return {
    set(dark: boolean) {
      mql.matches = dark
      listeners.forEach((cb) => cb({ matches: dark }))
    },
    listenerCount: () => listeners.size,
  }
}

afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia
})

describe('getColorScheme', () => {
  it('returns "light" when matchMedia is unavailable', () => {
    expect(getColorScheme()).toBe('light')
  })

  it('reflects the current system preference', () => {
    const m = mockMatchMedia(true)
    expect(getColorScheme()).toBe('dark')
    m.set(false)
    expect(getColorScheme()).toBe('light')
  })
})

describe('watchColorScheme', () => {
  it('invokes the callback on each scheme change', () => {
    const m = mockMatchMedia(false)
    const seen: string[] = []
    watchColorScheme((s) => seen.push(s))
    m.set(true)
    m.set(false)
    expect(seen).toEqual(['dark', 'light'])
  })

  it('stop() unsubscribes (no further callbacks)', () => {
    const m = mockMatchMedia(false)
    const seen: string[] = []
    const stop = watchColorScheme((s) => seen.push(s))
    m.set(true)
    stop()
    m.set(false)
    expect(seen).toEqual(['dark'])
    expect(m.listenerCount()).toBe(0)
  })

  it('is a no-op (returns a callable) when matchMedia is unavailable', () => {
    const stop = watchColorScheme(() => {})
    expect(typeof stop).toBe('function')
    expect(() => stop()).not.toThrow()
  })

  it('double stop is safe', () => {
    mockMatchMedia(false)
    const stop = watchColorScheme(() => {})
    stop()
    expect(() => stop()).not.toThrow()
  })
})
