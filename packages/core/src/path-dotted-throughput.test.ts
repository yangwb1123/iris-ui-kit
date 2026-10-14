import { describe, expect, it, vi } from 'vitest'
import { parsePath, PathError } from './path'

describe('plain dotted field path decoding', () => {
  it('avoids the general segment-regex loop for proven plain dotted paths', () => {
    const original = RegExp.prototype.exec
    let general = 0
    const spy = vi.spyOn(RegExp.prototype, 'exec').mockImplementation(function (
      this: RegExp,
      input: string,
    ) {
      if (this.source === '\\[([^\\]]*)\\]|[^.[\\]]+') general++
      return original.call(this, input)
    })
    try {
      for (let i = 0; i < 100; i++) {
        expect(parsePath('user.profile.name')).toEqual(['user', 'profile', 'name'])
        expect(parsePath('user.profile.address.city')).toEqual([
          'user',
          'profile',
          'address',
          'city',
        ])
      }
    } finally {
      spy.mockRestore()
    }
    expect(general).toBe(0)
  })

  it('keeps numeric conversion, literal text and independently mutable results', () => {
    const cases: [string, (string | number)[]][] = [
      ['orders.0003.qty', ['orders', 3, 'qty']],
      ['002.01.0', [2, 1, 0]],
      ['user. 2 .name', ['user', ' 2 ', 'name']],
      ["user.'0'.name", ['user', "'0'", 'name']],
      ['user.a"b.name', ['user', 'a"b', 'name']],
      ['用户.地址.城市', ['用户', '地址', '城市']],
      ['a.\n.b', ['a', '\n', 'b']],
      ['a.\n', ['a', '\n']],
      ['constructor.child', ['constructor', 'child']],
      ['prototype.child', ['prototype', 'child']],
      [`a.${'9'.repeat(400)}`, ['a', Infinity]],
    ]
    for (const [path, expected] of cases) {
      const first = parsePath(path)
      expect(first).toEqual(expected)
      first[0] = 'changed'
      expect(parsePath(path)).toEqual(expected)
    }
  })

  it('keeps each segment push before the live allowReserved getter', () => {
    const original = Array.prototype.push
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'push')!
    let events = ''
    Object.defineProperty(Array.prototype, 'push', {
      ...descriptor,
      value(this: unknown[], ...items: unknown[]) {
        if (items.length === 1 && ['user', 'profile', 'name'].includes(items[0] as string)) {
          events += `push:${items[0]}|`
        }
        return original.apply(this, items)
      },
    })
    let result: (string | number)[]
    try {
      result = parsePath('user.profile.name', {
        get allowReserved() {
          events += 'options|'
          return false
        },
      })
    } finally {
      Object.defineProperty(Array.prototype, 'push', descriptor)
    }
    expect(result).toEqual(['user', 'profile', 'name'])
    expect(events).toBe('push:user|push:profile|push:name|options|')
  })

  it('propagates segment push failure before reading validation options', () => {
    const original = Array.prototype.push
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'push')!
    const failure = new Error('segment output failed')
    let optionReads = 0
    let caught: unknown
    Object.defineProperty(Array.prototype, 'push', {
      ...descriptor,
      value(this: unknown[], ...items: unknown[]) {
        if (this.length === 1 && this[0] === 'user' && items[0] === 'profile') throw failure
        return original.apply(this, items)
      },
    })
    try {
      parsePath('user.profile.name', {
        get allowReserved() {
          optionReads++
          return false
        },
      })
    } catch (error) {
      caught = error
    } finally {
      Object.defineProperty(Array.prototype, 'push', descriptor)
    }
    expect(caught).toBe(failure)
    expect(optionReads).toBe(0)
  })

  it('reads reserved-key authorization afresh and preserves development errors', () => {
    vi.stubEnv('NODE_ENV', 'development')
    let allow = true
    let reads = 0
    const options = {
      get allowReserved() {
        reads++
        return allow
      },
    }
    try {
      expect(parsePath('user.__proto__.name', options)).toEqual(['user', '__proto__', 'name'])
      allow = false
      expect(() => parsePath('user.__proto__.name', options)).toThrow(PathError)
      expect(reads).toBe(2)
      for (const path of ['user.constructor.name', 'user.prototype.name']) {
        expect(() => parsePath(path)).toThrow(PathError)
      }
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('retains malformed-path policy and general bracket or non-primitive fallback', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (const path of ['.a.b', 'a.b.', 'a..b', 'a.\0.b', 'a.[0]', 'a[0]b', 'a..']) {
        vi.stubEnv('NODE_ENV', 'development')
        expect(() => parsePath(path)).toThrow(PathError)
        vi.stubEnv('NODE_ENV', 'production')
        warning.mockClear()
        expect(parsePath(path)).toEqual([])
        expect(warning).toHaveBeenCalledTimes(1)
      }
      expect(parsePath("orders[0]['first.name']")).toEqual(['orders', 0, 'first.name'])
      const boxed = Object('user.profile.name') as string
      expect(parsePath(boxed)).toEqual(['user', 'profile', 'name'])
      expect(() => parsePath(42 as unknown as string)).toThrow(TypeError)
      expect(parsePath(['__proto__', 'name'])).toEqual(['__proto__', 'name'])
    } finally {
      warning.mockRestore()
      vi.unstubAllEnvs()
    }
  })
})
