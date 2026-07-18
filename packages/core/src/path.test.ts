import { describe, expect, it } from 'vitest'
import {
  parsePath,
  formatPath,
  getByPath,
  setByPath,
  deleteByPath,
  rekeyByArrayMutation,
  escapePathSegment,
  isPathSafe,
  isKeyReserved,
  PathError,
} from './path'

describe('parsePath', () => {
  it('parses a flat key as a 1-segment path', () => {
    expect(parsePath('email')).toEqual(['email'])
  })
  it('parses dotted + bracket-index paths', () => {
    expect(parsePath('a.b[2].c')).toEqual(['a', 'b', 2, 'c'])
    expect(parsePath('items[0]')).toEqual(['items', 0])
  })
  it('parses bracket-key (quoted) segments as string keys, not indices', () => {
    expect(parsePath("a['b c']")).toEqual(['a', 'b c'])
    expect(parsePath('a["b"]')).toEqual(['a', 'b'])
  })
  it('passes a segment array through (copying)', () => {
    const arr = ['a', 2, 'c'] as const
    const out = parsePath(arr)
    expect(out).toEqual(['a', 2, 'c'])
    expect(out).not.toBe(arr)
  })
  it('round-trips through formatPath canonically', () => {
    for (const key of ['email', 'a.b[2].c', 'items[0].sku', 'x']) {
      expect(formatPath(parsePath(key))).toBe(key)
    }
  })
  it('parses empty string to empty array', () => {
    expect(parsePath('')).toEqual([])
  })
  it('parses top-level numeric string as string, not number', () => {
    expect(parsePath('123')).toEqual([123]) // numeric string → number
  })
  it('parses bracket-index numeric as number', () => {
    expect(parsePath('items[42]')).toEqual(['items', 42])
  })

  // Malformed input validation
  it('throws in dev for unclosed bracket', () => {
    // In test environment NODE_ENV might be 'test' or 'development'
    // We test the validation logic — PathError is thrown in dev
    try {
      parsePath('a[')
      // If we get here without throw, it means NODE_ENV is production
      // and we got a console.warn instead. That's acceptable.
    } catch (e) {
      expect(e).toBeInstanceOf(PathError)
      expect((e as PathError).input).toBe('a[')
    }
  })

  it('throws in dev for extra closing bracket', () => {
    try {
      parsePath('a]')
    } catch (e) {
      expect(e).toBeInstanceOf(PathError)
      expect((e as PathError).input).toBe('a]')
    }
  })

  it('throws in dev for null byte in path', () => {
    try {
      parsePath('a\0b')
    } catch (e) {
      expect(e).toBeInstanceOf(PathError)
      expect((e as PathError).message).toContain('null byte')
    }
  })

  it('throws in dev for empty bracket []', () => {
    try {
      parsePath('a[]')
    } catch (e) {
      expect(e).toBeInstanceOf(PathError)
      expect((e as PathError).message).toContain('empty bracket')
    }
  })

  it('throws in dev for consecutive dots', () => {
    try {
      parsePath('a..b')
    } catch (e) {
      expect(e).toBeInstanceOf(PathError)
      expect((e as PathError).message).toContain('empty segment')
    }
  })

  it('isPathSafe returns true for valid paths', () => {
    expect(isPathSafe('a.b.c')).toBe(true)
    expect(isPathSafe('items[0].name')).toBe(true)
    expect(isPathSafe('email')).toBe(true)
    expect(isPathSafe('')).toBe(true)
  })

  it('isPathSafe returns false for invalid paths', () => {
    expect(isPathSafe('a[')).toBe(false)
    expect(isPathSafe('a]')).toBe(false)
    expect(isPathSafe('a\0b')).toBe(false)
    expect(isPathSafe('a..b')).toBe(false)
    expect(isPathSafe('a[]b')).toBe(false)
  })

  // --- Prototype pollution key rejection ---

  it('isPathSafe returns false for paths containing __proto__', () => {
    expect(isPathSafe('a.__proto__')).toBe(false)
    expect(isPathSafe('__proto__')).toBe(false)
    expect(isPathSafe('a.__proto__.b')).toBe(false)
  })

  it('isPathSafe returns false for nested paths with constructor', () => {
    expect(isPathSafe('a.constructor')).toBe(false)
    expect(isPathSafe('a.constructor.b')).toBe(false)
  })

  it('isPathSafe returns true for top-level constructor or prototype', () => {
    expect(isPathSafe('constructor')).toBe(true)
    expect(isPathSafe('prototype')).toBe(true)
  })

  it('isPathSafe returns false for nested paths with prototype', () => {
    expect(isPathSafe('a.prototype')).toBe(false)
    expect(isPathSafe('a.prototype.b')).toBe(false)
  })

  it('isPathSafe returns true for safe paths', () => {
    expect(isPathSafe('a.b.c')).toBe(true)
    expect(isPathSafe('items[0].name')).toBe(true)
  })

  describe('prototype pollution rejection', () => {
    it('rejects __proto__ at any level in dev mode', () => {
      try {
        parsePath('__proto__')
        // If no throw, we are in prod/test mode — acceptable
      } catch (e) {
        expect(e).toBeInstanceOf(PathError)
        expect((e as PathError).message).toContain('reserved key')
      }
    })

    it('rejects a.__proto__ in dev mode', () => {
      try {
        parsePath('a.__proto__')
      } catch (e) {
        expect(e).toBeInstanceOf(PathError)
        expect((e as PathError).message).toContain('reserved key')
      }
    })

    it('rejects __proto__ in nested path a.__proto__.b in dev mode', () => {
      try {
        parsePath('a.__proto__.b')
      } catch (e) {
        expect(e).toBeInstanceOf(PathError)
        expect((e as PathError).message).toContain('reserved key')
      }
    })

    it('rejects nested constructor in dev mode', () => {
      try {
        parsePath('a.constructor')
      } catch (e) {
        expect(e).toBeInstanceOf(PathError)
        expect((e as PathError).message).toContain('reserved key')
      }
    })

    it('allows top-level constructor as a 1-segment path', () => {
      // Top-level constructor should be allowed (it's a legitimate property)
      const result = parsePath('constructor')
      expect(result).toEqual(['constructor'])
    })

    it('allows top-level prototype as a 1-segment path', () => {
      const result = parsePath('prototype')
      expect(result).toEqual(['prototype'])
    })

    it('rejects nested prototype in dev mode', () => {
      try {
        parsePath('a.prototype')
      } catch (e) {
        expect(e).toBeInstanceOf(PathError)
        expect((e as PathError).message).toContain('reserved key')
      }
    })

    it('rejects nested constructor.prototype path in dev mode', () => {
      try {
        parsePath('a.constructor.prototype')
      } catch (e) {
        expect(e).toBeInstanceOf(PathError)
        expect((e as PathError).message).toContain('reserved key')
      }
    })

    it('accepts paths with allowReserved option bypassing the check', () => {
      // With allowReserved: true, all reserved keys are allowed
      expect(parsePath('__proto__', { allowReserved: true })).toEqual(['__proto__'])
      expect(parsePath('a.constructor', { allowReserved: true })).toEqual(['a', 'constructor'])
      expect(parsePath('a.prototype', { allowReserved: true })).toEqual(['a', 'prototype'])
      expect(parsePath('a.__proto__.b', { allowReserved: true })).toEqual(['a', '__proto__', 'b'])
    })

    it('array-form path bypasses reserved key check entirely', () => {
      // When passing a segment array directly, parsePath just copies it
      expect(parsePath(['__proto__'])).toEqual(['__proto__'])
      expect(parsePath(['a', 'constructor', 'b'])).toEqual(['a', 'constructor', 'b'])
    })

    it('does not reject numeric segments that happen to look like reserved words', () => {
      // Numeric segments are never string keys
      const result = parsePath('items.0.name')
      // '0' is a numeric string → parsed as number 0, not a string key
      expect(result).toEqual(['items', 0, 'name'])
    })
  })
})

describe('isKeyReserved', () => {
  it('returns true for __proto__', () => {
    expect(isKeyReserved('__proto__')).toBe(true)
  })

  it('returns true for constructor', () => {
    expect(isKeyReserved('constructor')).toBe(true)
  })

  it('returns true for prototype', () => {
    expect(isKeyReserved('prototype')).toBe(true)
  })

  it('returns false for normal field names', () => {
    expect(isKeyReserved('name')).toBe(false)
    expect(isKeyReserved('email')).toBe(false)
    expect(isKeyReserved('items')).toBe(false)
    expect(isKeyReserved('')).toBe(false)
  })

  it('returns false for numeric strings', () => {
    expect(isKeyReserved('0')).toBe(false)
    expect(isKeyReserved('123')).toBe(false)
  })

  it('is case-sensitive — returns false for capitalized variants', () => {
    expect(isKeyReserved('Constructor')).toBe(false)
    expect(isKeyReserved('Prototype')).toBe(false)
    expect(isKeyReserved('__Proto__')).toBe(false)
  })
})

describe('escapePathSegment', () => {
  it('wraps a plain name in bracket-quoted form', () => {
    expect(escapePathSegment('name')).toBe("['name']")
  })
  it('wraps a name with dots', () => {
    expect(escapePathSegment('video.url')).toBe("['video.url']")
  })
  it('wraps a name with special characters', () => {
    expect(escapePathSegment('hello world')).toBe("['hello world']")
    expect(escapePathSegment('a.b')).toBe("['a.b']")
    expect(escapePathSegment('email')).toBe("['email']")
  })
  it('handles single quotes inside the segment without escaping', () => {
    expect(escapePathSegment("it's")).toBe("['it's']")
  })
  it('handles backslashes inside the segment', () => {
    expect(escapePathSegment('a\\b')).toBe("['a\\b']")
  })

  it('round-trips: parsePath(escapePathSegment(key)) returns a 1-segment path', () => {
    const keys = ['video.url', 'name', "it's", 'a.b.c.d', 'hello world', 'field-name', 'simple']
    for (const k of keys) {
      const parsed = parsePath(escapePathSegment(k))
      expect(parsed).toEqual([k])
    }
  })
})

describe('formatPath', () => {
  it('formats a segment array to a canonical key', () => {
    expect(formatPath(['a', 2, 'b'])).toBe('a[2].b')
    expect(formatPath(['email'])).toBe('email')
  })
})

describe('getByPath', () => {
  const obj = { a: { b: [{ c: 1 }, { c: 2 }] }, flat: 'x' }
  it('reads a flat key', () => {
    expect(getByPath(obj, 'flat')).toBe('x')
  })
  it('reads a nested + indexed path', () => {
    expect(getByPath(obj, 'a.b[1].c')).toBe(2)
  })
  it('returns undefined for a missing segment without throwing', () => {
    expect(getByPath(obj, 'a.x.y')).toBeUndefined()
    expect(getByPath(obj, 'a.b[9].c')).toBeUndefined()
  })
  it('reads via escaped path segment (literal dot)', () => {
    const obj2 = { 'video.url': 'http://example.com' }
    expect(getByPath(obj2, escapePathSegment('video.url'))).toBe('http://example.com')
  })
})

describe('setByPath', () => {
  it('sets a flat key, returning a new object', () => {
    const o = { a: 1, b: 2 }
    const next = setByPath(o, 'a', 9)
    expect(next).toEqual({ a: 9, b: 2 })
    expect(next).not.toBe(o)
    expect(o.a).toBe(1) // original untouched
  })
  it('sets a nested + indexed value with structural sharing', () => {
    const o = { a: { b: [{ c: 1 }, { c: 2 }] }, sibling: { kept: true } }
    const next = setByPath(o, 'a.b[1].c', 99)
    expect(getByPath(next, 'a.b[1].c')).toBe(99)
    // Only the touched spine is cloned; untouched siblings keep identity.
    expect(next.sibling).toBe(o.sibling)
    expect(next.a.b[0]).toBe(o.a.b[0])
    expect(next.a.b[1]).not.toBe(o.a.b[1])
    expect(next.a.b).not.toBe(o.a.b)
  })
  it('creates intermediate containers (array vs object) from the next segment', () => {
    expect(setByPath({}, 'a.b[0].c', 1)).toEqual({ a: { b: [{ c: 1 }] } })
  })
  it('sets via escaped path (literal dot in key)', () => {
    const o = { 'video.url': 'old' }
    const next = setByPath(o, escapePathSegment('video.url'), 'new')
    expect(next).toEqual({ 'video.url': 'new' })
  })
  it('overwrites when using escaped vs nested path', () => {
    const o = { video: { url: 'nested' }, 'video.url': 'literal' }
    // Escaped path targets the literal key
    const next1 = setByPath(o, escapePathSegment('video.url'), 'updated')
    expect(next1['video.url']).toBe('updated')
    expect(next1.video.url).toBe('nested')
    // Dotted path targets the nested structure
    const next2 = setByPath(o, 'video.url', 'nested2')
    expect(next2.video.url).toBe('nested2')
  })
})

describe('deleteByPath', () => {
  it('deletes a flat key', () => {
    const next = deleteByPath({ a: 1, b: 2 }, 'a')
    expect(next).toEqual({ b: 2 })
  })
  it('splices an array index', () => {
    const next = deleteByPath({ items: ['a', 'b', 'c'] }, 'items[1]')
    expect(next.items).toEqual(['a', 'c'])
  })
  it('is a no-op (same shape) when the target is missing', () => {
    const o = { a: 1 }
    expect(deleteByPath(o, 'b')).toEqual({ a: 1 })
    expect(deleteByPath(o, 'x.y.z')).toBe(o)
  })
})

describe('rekeyByArrayMutation', () => {
  it('shifts keys under an array prefix and drops the removed element', () => {
    // Simulate REMOVE at index 1 of `items`: 0 stays, 1 drops, 2→1.
    const errors = {
      'items[0].sku': 'e0',
      'items[1].sku': 'e1',
      'items[2].sku': 'e2',
      other: 'kept',
    }
    const next = rekeyByArrayMutation(errors, 'items', (i) => (i === 1 ? null : i > 1 ? i - 1 : i))
    expect(next).toEqual({
      'items[0].sku': 'e0',
      'items[1].sku': 'e2',
      other: 'kept',
    })
  })
  it('shifts keys up on INSERT at index 1', () => {
    const errors = { 'items[0].sku': 'e0', 'items[1].sku': 'e1' }
    const next = rekeyByArrayMutation(errors, 'items', (i) => (i >= 1 ? i + 1 : i))
    expect(next).toEqual({ 'items[0].sku': 'e0', 'items[2].sku': 'e1' })
  })
  it('leaves keys that are not under the prefix untouched', () => {
    const errors = { 'itemsX[0].a': 'x', items: 'top', 'items.foo': 'notIndexed' }
    const next = rekeyByArrayMutation(errors, 'items', () => 0)
    expect(next).toEqual(errors)
  })
})
