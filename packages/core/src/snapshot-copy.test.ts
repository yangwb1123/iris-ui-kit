import { describe, expect, it, vi } from 'vitest'
import { cloneRuntimeValue } from './outbox-runtime'
import { cloneFormDraftValue } from './form/drafts'

const cloners = [cloneRuntimeValue, cloneFormDraftValue]

describe.each(cloners)('owned snapshot properties — %s', (clone) => {
  it('avoids descriptor allocation for ordinary missing data properties', () => {
    const input = Array.from({ length: 100 }, (_, id) => ({ id, nested: { value: id } }))
    const define = vi.spyOn(Object, 'defineProperty')
    let copy: typeof input
    let idDefinitions: number
    try {
      copy = clone(input) as typeof input
      idDefinitions = define.mock.calls.filter(([, key]) => key === 'id').length
    } finally {
      define.mockRestore()
    }
    expect(idDefinitions).toBeLessThanOrEqual(1)
    input[0]!.nested.value = -1
    expect(copy[0]!.nested.value).toBe(0)
    expect(copy).not.toBe(input)
  })

  it('preserves cycles, shared children, null prototypes and prototype-sensitive own keys', () => {
    const child = { value: 1 }
    const input = Object.create(null) as Record<string, unknown>
    input.left = child
    input.right = child
    input.self = input
    input.__proto__ = { safe: true }
    input.constructor = 'own' as never
    const copy = clone(input) as typeof input
    expect(Object.getPrototypeOf(copy)).toBeNull()
    expect(copy.self).toBe(copy)
    expect(copy.left).toBe(copy.right)
    expect(copy.left).not.toBe(child)
    expect(copy.__proto__).toEqual({ safe: true })
    expect(copy.constructor).toBe('own')
  })

  it('does not invoke an inherited setter installed while a child getter is being cloned', () => {
    const setter = vi.fn()
    const input = {
      get irisPerfField() {
        Object.defineProperty(Object.prototype, 'irisPerfField', {
          configurable: true,
          set: setter,
        })
        return { value: 1 }
      },
    }
    let copy: typeof input
    try {
      copy = clone(input) as typeof input
    } finally {
      Reflect.deleteProperty(Object.prototype, 'irisPerfField')
    }
    expect(setter).not.toHaveBeenCalled()
    expect(Object.getOwnPropertyDescriptor(copy, 'irisPerfField')).toMatchObject({
      value: { value: 1 },
      configurable: true,
      enumerable: true,
      writable: true,
    })
  })

  it('keeps recursive getter evaluation order and does not read symbol getters', () => {
    const reads: string[] = []
    const symbol = Symbol('ignored')
    const input = {
      get first() {
        reads.push('first')
        return {
          get child() {
            reads.push('child')
            return 1
          },
        }
      },
      get second() {
        reads.push('second')
        return 2
      },
      get [symbol]() {
        throw new Error('symbol getters must not be evaluated')
      },
    }
    const copy = clone(input)
    expect(copy).toEqual({ first: { child: 1 }, second: 2 })
    expect(reads).toEqual(['first', 'child', 'second'])
    expect(Object.getOwnPropertySymbols(copy)).toEqual([])
  })
})

it('discarded draft output retains alias/cycle/getter and proxy reflection reads without writing inputs', () => {
  const reads: string[] = []
  const shared = {
    get value() {
      reads.push('value')
      return 1
    },
  }
  const target: Record<string, unknown> = { left: shared, right: shared }
  const source = new Proxy(target, {
    getPrototypeOf(value) {
      reads.push('prototype')
      return Object.getPrototypeOf(value)
    },
    ownKeys(value) {
      reads.push('keys')
      return Reflect.ownKeys(value)
    },
    set() {
      throw new Error('reading validation values must not write inputs')
    },
  })
  target.self = source
  cloneFormDraftValue(source)
  const originalReads = [...reads]
  reads.length = 0
  expect(cloneFormDraftValue(source, undefined, false)).toBe(source)
  expect(reads).toEqual(originalReads)
  expect(reads.filter((read) => read === 'value')).toHaveLength(1)
})

it('retains runtime custom prototypes without probing a proxy prototype for inherited keys', () => {
  const has = vi.fn(() => {
    throw new Error('prototype has trap must not run')
  })
  const prototype = new Proxy({}, { has })
  const input = Object.create(prototype) as Record<string, unknown>
  Object.defineProperty(input, 'key', { enumerable: true, value: { value: 1 } })
  const copy = cloneRuntimeValue(input)
  expect(Object.getPrototypeOf(copy)).toBe(prototype)
  expect(has).not.toHaveBeenCalled()
  expect(copy.key).toEqual({ value: 1 })
  expect(copy.key).not.toBe(input.key)
  expect(cloneFormDraftValue(input)).toBe(input)
})
