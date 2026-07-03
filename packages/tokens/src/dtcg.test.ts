import { describe, expect, it } from 'vitest'
import { toDtcg, toDtcgJson, type DtcgGroup, type DtcgToken } from './dtcg'
import { lightTheme } from './light'
import { darkTheme } from './dark'
import {
  COLOR_TOKENS,
  SPACING_TOKENS,
  RADII_TOKENS,
  SHADOW_TOKENS,
  ZINDEX_TOKENS,
  TRANSITION_TOKENS,
} from './tokens'

function isToken(n: DtcgGroup | DtcgToken): n is DtcgToken {
  return typeof (n as DtcgToken).$value === 'string'
}

/** Walk every leaf token, yielding its dotted path. */
function leaves(group: DtcgGroup, prefix: string[] = [], depth = 0): Array<[string[], DtcgToken]> {
  if (depth > 50) return [] // safety guard against circular refs
  const out: Array<[string[], DtcgToken]> = []
  for (const [key, node] of Object.entries(group)) {
    if (typeof node !== 'object' || node === null) continue // skip primitives (e.g. $type string values)
    if (isToken(node)) out.push([[...prefix, key], node])
    else out.push(...leaves(node as DtcgGroup, [...prefix, key], depth + 1))
  }
  return out
}

describe('toDtcg', () => {
  it('emits a $type/$value for every token, none missing', () => {
    const doc = toDtcg(lightTheme)
    const total =
      COLOR_TOKENS.length +
      SPACING_TOKENS.length +
      RADII_TOKENS.length +
      SHADOW_TOKENS.length +
      ZINDEX_TOKENS.length +
      TRANSITION_TOKENS.length
    expect(leaves(doc).length).toBe(total)
    for (const [, token] of leaves(doc)) {
      expect(
        token.$type === 'color' || token.$type === 'dimension' || token.$type === 'shadow',
      ).toBe(true)
      expect(typeof token.$value).toBe('string')
    }
  })

  it('nests by dot path under the iris group', () => {
    const doc = toDtcg(lightTheme)
    const iris = doc.iris as DtcgGroup
    expect(iris).toBeDefined()
    expect(iris.background).toEqual({ $type: 'color', $value: '#ffffff' })
  })

  it('relocates a base token to DEFAULT when it is also a prefix (surface, primary)', () => {
    const doc = toDtcg(lightTheme)
    const iris = doc.iris as DtcgGroup
    const surface = iris.surface as DtcgGroup
    // surface is both a token (iris.surface) and a prefix (iris.surface.hover)
    expect(isToken(surface)).toBe(false)
    expect(surface.DEFAULT).toEqual({ $type: 'color', $value: '#f8fafc' })
    expect(surface.hover).toEqual({ $type: 'color', $value: '#f1f5f9' })

    const primary = iris.primary as DtcgGroup
    expect(primary.DEFAULT).toEqual({ $type: 'color', $value: '#6366f1' })
    expect(primary.foreground).toEqual({ $type: 'color', $value: '#ffffff' })
  })

  it('emits dimensions as px strings', () => {
    const doc = toDtcg(lightTheme)
    const iris = doc.iris as DtcgGroup
    expect((iris.gap as DtcgGroup).sm).toEqual({ $type: 'dimension', $value: '4px' })
    expect((iris.radius as DtcgGroup).md).toEqual({ $type: 'dimension', $value: '6px' })
  })

  it('round-trips both built-in themes to valid JSON with no token/group collisions', () => {
    for (const theme of [lightTheme, darkTheme]) {
      const json = toDtcgJson(theme)
      const parsed = JSON.parse(json) as DtcgGroup
      // No node is simultaneously a token and a group (spec invariant).
      for (const [, node] of leaves(parsed)) {
        expect(Object.keys(node).every((k) => k.startsWith('$'))).toBe(true)
      }
    }
  })
})
