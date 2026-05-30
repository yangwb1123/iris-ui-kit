import { describe, it, expect, vi, afterEach } from 'vitest'
import { memorySkinStorage, localStorageSkinStorage } from './storage'

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      m.set(k, String(v))
    },
    removeItem: (k: string) => {
      m.delete(k)
    },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    length: 0,
  } as unknown as Storage
}

describe('memorySkinStorage', () => {
  it('round-trips and clears', () => {
    const s = memorySkinStorage()
    expect(s.get()).toBeNull()
    s.set('x')
    expect(s.get()).toBe('x')
    s.remove()
    expect(s.get()).toBeNull()
  })
})

describe('localStorageSkinStorage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips when localStorage is available', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const s = localStorageSkinStorage('iris-skin-test')
    s.set('ocean')
    expect(s.get()).toBe('ocean')
    s.remove()
    expect(s.get()).toBeNull()
  })

  it('is SSR-safe: a no-op when localStorage is unavailable', () => {
    const s = localStorageSkinStorage('iris-skin-test')
    expect(s.get()).toBeNull()
    expect(() => s.set('x')).not.toThrow()
    expect(s.get()).toBeNull()
  })
})
