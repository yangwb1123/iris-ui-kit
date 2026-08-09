import { describe, expect, it } from 'vitest'
import { buildFormValues, mergeFormFilters, seedFormValues } from './table-form'

const fields = [{ key: 'name', defaultValue: 'Ada' }, { key: 'status' }]

describe('seedFormValues', () => {
  it('seeds from defaultValue, skipping fields without one', () => {
    expect(seedFormValues(fields)).toEqual({ name: 'Ada' })
  })

  it('treats an empty defaultValue as absent', () => {
    expect(seedFormValues([{ key: 'name', defaultValue: '' }])).toEqual({})
  })

  it('handles undefined fields', () => {
    expect(seedFormValues(undefined)).toEqual({})
  })

  it('returns a fresh object every call (no shared mutation)', () => {
    const a = seedFormValues(fields)
    const b = seedFormValues(fields)
    a.name = 'changed'
    expect(b).toEqual({ name: 'Ada' })
  })
})

describe('buildFormValues', () => {
  it('includes every declared field that has a value', () => {
    expect(buildFormValues(fields, { name: 'Bob', status: 'active' })).toEqual({
      name: 'Bob',
      status: 'active',
    })
  })

  it('strips empty strings (inactive filters never reach the query)', () => {
    expect(buildFormValues(fields, { name: 'Bob', status: '' })).toEqual({ name: 'Bob' })
  })

  it('omits fields the draft never touched', () => {
    expect(buildFormValues(fields, {})).toEqual({})
  })

  it('ignores draft keys that are not declared fields', () => {
    expect(buildFormValues(fields, { name: 'Bob', stray: 'x' })).toEqual({ name: 'Bob' })
  })

  it('handles undefined fields', () => {
    expect(buildFormValues(undefined, { name: 'Bob' })).toEqual({})
  })
})

describe('mergeFormFilters', () => {
  it('merges form values over the base, form winning on conflict', () => {
    expect(mergeFormFilters({ age: '25', name: 'old' }, { name: 'new' })).toEqual({
      age: '25',
      name: 'new',
    })
  })

  it('drops empty strings from BOTH inputs', () => {
    expect(mergeFormFilters({ age: '', name: 'Ada' }, { name: '', status: 'active' })).toEqual({
      name: 'Ada',
      status: 'active',
    })
  })

  it('never mutates the inputs', () => {
    const base = { age: '25', name: '' }
    const values = { name: 'Ada' }
    const merged = mergeFormFilters(base, values)
    expect(merged).toEqual({ age: '25', name: 'Ada' })
    expect(base).toEqual({ age: '25', name: '' })
    expect(values).toEqual({ name: 'Ada' })
    expect(merged).not.toBe(base)
    expect(merged).not.toBe(values)
  })

  it('returns {} for empty inputs', () => {
    expect(mergeFormFilters({}, {})).toEqual({})
    // `{ name: '' }` and `{}` are the same filter state (vxe contract).
    expect(mergeFormFilters({ name: '' }, {})).toEqual({})
  })
})
