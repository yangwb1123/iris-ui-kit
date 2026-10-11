import { describe, expect, it, vi } from 'vitest'
import * as properties from './snapshot-properties'
import { cloneRuntimeValue } from './outbox-runtime'
import { cloneFormDraftValue } from './form/drafts'

const cloners = [cloneRuntimeValue, cloneFormDraftValue]

describe.each(cloners)('snapshot dispatch — %s', (clone) => {
  it('reuses one copier callback and one per-pass memo across ordinary records', () => {
    const shared = { value: 1 }
    const source = Array.from({ length: 50 }, (_, id) => ({ id, left: shared, right: shared }))
    const spy = vi.spyOn(properties, 'copySnapshotProperties')
    let copy: typeof source
    let callbacks: Set<unknown>
    let contexts: Set<unknown>
    try {
      copy = clone(source) as typeof source
      callbacks = new Set(spy.mock.calls.map((args) => args[2]))
      contexts = new Set(spy.mock.calls.map((args) => (args as unknown[])[3]))
    } finally {
      spy.mockRestore()
    }
    expect(callbacks.size).toBe(1)
    expect(contexts.size).toBe(1)
    expect(contexts.has(undefined)).toBe(false)
    expect(copy[0]!.left).toBe(copy[49]!.right)
    expect(copy[0]!.left).not.toBe(shared)
    shared.value = -1
    expect(copy[0]!.left.value).toBe(1)
  })
})

it('discarded traversal avoids repeated array-brand probes but preserves prototype/getter order', () => {
  const reads: string[] = []
  const row = new Proxy(
    {
      get value() {
        reads.push('value')
        return 1
      },
    },
    {
      getPrototypeOf(target) {
        reads.push('prototype')
        return Object.getPrototypeOf(target)
      },
      ownKeys(target) {
        reads.push('keys')
        return Reflect.ownKeys(target)
      },
      set() {
        throw new Error('discarded traversal must not write inputs')
      },
    },
  )
  const source = [row, row, null, undefined, 1, 'text', Symbol('leaf'), () => 1]
  const spy = vi.spyOn(Array, 'isArray')
  let rowProbes: number
  try {
    expect(cloneFormDraftValue(source, undefined, false)).toBe(source)
    rowProbes = spy.mock.calls.filter(([value]) => value === row).length
  } finally {
    spy.mockRestore()
  }
  expect(rowProbes).toBe(1)
  expect(reads).toEqual(['prototype', 'prototype', 'keys', 'value'])
})
