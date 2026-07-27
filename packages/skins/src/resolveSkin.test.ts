import { describe, it, expect } from 'vitest'
import { lightTheme } from '@iris-ui-kit/tokens'
import { resolveSkin, type SkinLookup } from './resolveSkin'
import { SkinResolutionError } from './errors'
import type { Skin } from './types'

function lookup(skins: Skin[]): SkinLookup {
  const map = new Map(skins.map((s) => [s.id, s]))
  return { get: (id) => map.get(id) }
}

const base: Skin = {
  id: 'base',
  type: 'light',
  tokens: {
    ...lightTheme.colors,
    ...lightTheme.spacing,
    ...lightTheme.radii,
    ...lightTheme.shadows,
    ...lightTheme.zIndex,
    ...lightTheme.transitions,
  },
}

describe('resolveSkin', () => {
  it('resolves a complete skin to a full IrisTheme', () => {
    const r = resolveSkin(base, lookup([base]))
    expect(r.theme.colors['iris.primary']).toBe(lightTheme.colors['iris.primary'])
    expect(r.theme.shadows).toEqual(lightTheme.shadows)
    expect(r.theme.zIndex).toEqual(lightTheme.zIndex)
    expect(r.theme.transitions).toEqual(lightTheme.transitions)
    expect(r.lineage).toEqual(['base'])
    expect(r.type).toBe('light')
  })

  it('merges extends base→leaf, child wins', () => {
    const child: Skin = {
      id: 'child',
      extends: 'base',
      type: 'dark',
      tokens: {
        'iris.primary': '#abcdef',
        'iris.shadow.sm': '0 2px 4px rgb(0 0 0 / 0.2)',
        'iris.z.toast': 2000,
        'iris.transition.fast': '80ms',
      },
      custom: { 'brand.x': 4 },
    }
    const r = resolveSkin(child, lookup([base, child]))
    expect(r.theme.colors['iris.primary']).toBe('#abcdef')
    expect(r.theme.colors['iris.background']).toBe(lightTheme.colors['iris.background'])
    expect(r.theme.shadows?.['iris.shadow.sm']).toBe('0 2px 4px rgb(0 0 0 / 0.2)')
    expect(r.theme.zIndex?.['iris.z.toast']).toBe(2000)
    expect(r.theme.transitions?.['iris.transition.fast']).toBe('80ms')
    expect(r.type).toBe('dark')
    expect(r.custom['brand.x']).toBe(4)
    expect(r.lineage).toEqual(['base', 'child'])
  })

  it('throws incomplete when a core token is missing', () => {
    const partial: Skin = { id: 'p', tokens: { 'iris.primary': '#000' } }
    expect(() => resolveSkin(partial, lookup([partial]))).toThrowError(SkinResolutionError)
  })

  it('throws missing-parent for an unknown extends id', () => {
    const child: Skin = { id: 'c', extends: 'ghost' }
    try {
      resolveSkin(child, lookup([child]))
      expect.unreachable()
    } catch (e) {
      expect((e as SkinResolutionError).error.code).toBe('missing-parent')
    }
  })

  it('detects cycles', () => {
    const a: Skin = { id: 'a', extends: 'b' }
    const b: Skin = { id: 'b', extends: 'a' }
    try {
      resolveSkin(a, lookup([a, b]))
      expect.unreachable()
    } catch (e) {
      expect((e as SkinResolutionError).error.code).toBe('cycle')
    }
  })
})
