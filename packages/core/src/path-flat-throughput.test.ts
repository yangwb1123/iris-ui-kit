import { describe, expect, it, vi } from 'vitest'
import { parsePath, PathError } from './path'

describe('flat field path decoding', () => {
  it('does not allocate the general segment-regex loop for ordinary flat fields', () => {
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
      for (let i = 0; i < 100; i++) expect(parsePath('field name')).toEqual(['field name'])
    } finally {
      spy.mockRestore()
    }
    expect(general).toBe(0)
  })

  it('keeps flat numeric conversion, detached segments and literal whitespace/quotes', () => {
    for (const key of ['name', 'constructor', 'prototype', 'field name', 'a"b', ' 2 ']) {
      expect(parsePath(key)).toEqual([key])
      const first = parsePath(key)
      first[0] = 'changed'
      expect(parsePath(key)).toEqual([key])
    }
    expect(parsePath('002')).toEqual([2])
    expect(parsePath('')).toEqual([])
    expect(parsePath("rows[0]['first name']")).toEqual(['rows', 0, 'first name'])
  })

  it('preserves reserved, malformed and wrong-type rejection in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    try {
      expect(parsePath('__proto__', { allowReserved: true })).toEqual(['__proto__'])
      for (const path of ['__proto__', 'a.__proto__', 'a[', 'a..b', 'a\0b', 'a]']) {
        expect(() => parsePath(path)).toThrow(PathError)
      }
      expect(() => parsePath(42 as unknown as string)).toThrow(TypeError)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
