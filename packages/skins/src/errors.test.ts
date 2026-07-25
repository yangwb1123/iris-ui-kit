import { describe, expect, it } from 'vitest'
import { skinError, SkinResolutionError } from './errors'

describe('skinError', () => {
  it('creates an error with code and message', () => {
    const err = skinError('validate', 'Invalid skin')
    expect(err.code).toBe('validate')
    expect(err.message).toBe('Invalid skin')
  })

  it('includes optional id and keys', () => {
    const err = skinError('cycle', 'Circular extends', { id: 'my-skin', keys: ['a', 'b'] })
    expect(err.id).toBe('my-skin')
    expect(err.keys).toEqual(['a', 'b'])
  })

  it('works without extra', () => {
    const err = skinError('load', 'Failed to load')
    expect(err.id).toBeUndefined()
    expect(err.keys).toBeUndefined()
  })
})

describe('SkinResolutionError', () => {
  it('is an Error with name and typed error', () => {
    const inner = skinError('missing-parent', 'Parent not found', { id: 'child' })
    const ex = new SkinResolutionError(inner)
    expect(ex).toBeInstanceOf(Error)
    expect(ex.name).toBe('SkinResolutionError')
    expect(ex.message).toBe('Parent not found')
    expect(ex.error.code).toBe('missing-parent')
    expect(ex.error.id).toBe('child')
  })
})
