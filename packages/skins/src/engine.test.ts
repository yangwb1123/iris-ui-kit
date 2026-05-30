import { describe, it, expect, vi } from 'vitest'
import { createSkinEngine } from './engine'
import { memorySkinStorage } from './storage'
import type { Skin } from './types'

const brand: Skin = {
  id: 'brand',
  extends: 'dark',
  tokens: { 'iris.primary': '#abc' },
  variants: { light: 'light', dark: 'dark' },
}

describe('createSkinEngine', () => {
  it('initializes to default and switches skins', () => {
    const engine = createSkinEngine({ skins: [brand], default: 'light' })
    expect(engine.current().id).toBe('light')
    engine.setSkin('brand')
    expect(engine.current().id).toBe('brand')
    expect(engine.current().theme.colors['iris.primary']).toBe('#abc')
  })

  it('persists selection through storage and restores it', () => {
    const storage = memorySkinStorage()
    const a = createSkinEngine({ skins: [brand], default: 'light', storage })
    a.setSkin('brand')
    expect(storage.get()).toBe('brand')
    const b = createSkinEngine({ skins: [brand], default: 'light', storage })
    expect(b.current().id).toBe('brand')
  })

  it('falls back to default when stored skin is unknown, recording an error', () => {
    const storage = memorySkinStorage('ghost')
    const engine = createSkinEngine({ skins: [brand], default: 'light', storage })
    expect(engine.current().id).toBe('light')
    expect(engine.errors().length).toBeGreaterThan(0)
  })

  it('loadSkin registers + applies an inline skin', async () => {
    const engine = createSkinEngine({ default: 'light' })
    const r = await engine.loadSkin({
      id: 'inline',
      extends: 'light',
      tokens: { 'iris.primary': '#0f0' },
    })
    expect(r.id).toBe('inline')
    expect(engine.current().theme.colors['iris.primary']).toBe('#0f0')
  })

  it('live-edit patch overlays non-destructively; resetPatch reverts', () => {
    const engine = createSkinEngine({ skins: [brand], default: 'brand' })
    engine.patch({ tokens: { 'iris.primary': '#fff' }, custom: { 'brand.z': 9 } })
    expect(engine.current().theme.colors['iris.primary']).toBe('#fff')
    expect(engine.current().custom['brand.z']).toBe(9)
    // registry source untouched:
    expect(engine.registry.get('brand')?.tokens?.['iris.primary']).toBe('#abc')
    engine.resetPatch()
    expect(engine.current().theme.colors['iris.primary']).toBe('#abc')
  })

  it("system mode follows prefers-color-scheme via the skin's variants", () => {
    const listeners: Array<(e: { matches: boolean }) => void> = []
    let matches = false
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches,
      media: q,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.push(cb),
      removeEventListener: () => {},
      addListener: (cb: (e: { matches: boolean }) => void) => listeners.push(cb),
      removeListener: () => {},
    }))
    const engine = createSkinEngine({ skins: [brand], default: 'brand', mode: 'system' })
    expect(engine.current().id).toBe('light') // brand.variants.light
    matches = true
    listeners.forEach((cb) => cb({ matches: true }))
    expect(engine.current().id).toBe('dark') // brand.variants.dark
    engine.destroy()
    vi.unstubAllGlobals()
  })
})
