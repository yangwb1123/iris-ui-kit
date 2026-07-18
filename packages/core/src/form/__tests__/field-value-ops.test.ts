import { describe, expect, it } from 'vitest'
import {
  createFieldValueOps,
  insertItem,
  removeItem,
  swapItems,
  moveItem,
  insertRemap,
  removeRemap,
  swapRemap,
  moveRemap,
  rekeyMetadata,
} from '../../form'

describe('createFieldValueOps — integration', () => {
  const ops = createFieldValueOps<{ name: string; email: string; tags: string[] }>()
  const initial = { name: '', email: '', tags: [] as string[] }

  it('getFieldValue returns the value at a path', () => {
    expect(ops.getFieldValue({ name: 'Alice', email: 'a@b.com', tags: [] }, 'name')).toBe('Alice')
    expect(ops.getFieldValue({ name: 'Alice', email: 'a@b.com', tags: [] }, 'email')).toBe(
      'a@b.com',
    )
  })

  it('setFieldValue updates a single field value and marks it dirty', () => {
    const state = { values: { ...initial }, dirty: {} }
    const result = ops.setFieldValue(state, 'name', 'Alice', initial)
    expect(result.values.name).toBe('Alice')
    expect(result.dirty.name).toBe(true)
  })

  it('setFieldValue does not mark dirty when value equals initial', () => {
    const state = { values: { name: '', email: '', tags: [] }, dirty: {} }
    const result = ops.setFieldValue(state, 'name', '', initial)
    expect(result.values.name).toBe('')
    expect(result.dirty.name).toBe(false)
  })

  it('setFieldValue uses Object.is for dirty comparison', () => {
    const ops2 = createFieldValueOps<{ x: number }>()
    // Object.is(NaN, NaN) === true, so NaN === NaN → not dirty
    const state = { values: { x: NaN }, dirty: {} }
    const result = ops2.setFieldValue(state, 'x', NaN, { x: NaN })
    expect(result.dirty.x).toBe(false)

    // Object.is(+0, -0) === false, so +0 !== -0 → dirty
    const result2 = ops2.setFieldValue({ values: { x: 0 }, dirty: {} }, 'x', -0, { x: 0 })
    expect(result2.dirty.x).toBe(true)
  })

  it('setValues updates multiple fields and returns dirty flags', () => {
    const state = { values: { ...initial }, dirty: {} }
    const result = ops.setValues(state, { name: 'Alice', email: 'alice@example.com' }, initial)
    expect(result.values.name).toBe('Alice')
    expect(result.values.email).toBe('alice@example.com')
    expect(result.dirty.name).toBe(true)
    expect(result.dirty.email).toBe(true)
  })

  it('setValues marks only changed fields as dirty', () => {
    // Initial has name='Alice' (same as state value) and email='' (will change)
    const state = { values: { name: 'Alice', email: '', tags: [] }, dirty: {} }
    const result = ops.setValues(
      state,
      { name: 'Alice', email: 'bob@example.com' },
      { name: 'Alice', email: '', tags: [] },
    )
    expect(result.dirty.name).toBe(false) // unchanged from initial
    expect(result.dirty.email).toBe(true) // changed from initial
  })

  it('isDirty returns true when values differ', () => {
    expect(ops.isDirty('hello', 'world')).toBe(true)
  })

  it('isDirty returns false when values are same', () => {
    expect(ops.isDirty('hello', 'hello')).toBe(false)
  })
})

describe('insertItem', () => {
  it('inserts at the beginning', () => {
    expect(insertItem(['b', 'c'], 0, 'a')).toEqual(['a', 'b', 'c'])
  })
  it('inserts at the end', () => {
    expect(insertItem(['a', 'b'], 2, 'c')).toEqual(['a', 'b', 'c'])
  })
  it('inserts in the middle', () => {
    expect(insertItem(['a', 'c'], 1, 'b')).toEqual(['a', 'b', 'c'])
  })
  it('clamps index to array length when out of bounds', () => {
    expect(insertItem(['a'], 100, 'b')).toEqual(['a', 'b'])
  })
  it('clamps index to 0 when negative', () => {
    expect(insertItem(['a'], -5, 'b')).toEqual(['b', 'a'])
  })
  it('does not mutate the original array', () => {
    const original = ['a', 'b']
    const result = insertItem(original, 1, 'x')
    expect(original).toEqual(['a', 'b'])
    expect(result).toEqual(['a', 'x', 'b'])
  })
})

describe('removeItem', () => {
  it('removes at the beginning', () => {
    expect(removeItem(['a', 'b', 'c'], 0)).toEqual(['b', 'c'])
  })
  it('removes at the end', () => {
    expect(removeItem(['a', 'b', 'c'], 2)).toEqual(['a', 'b'])
  })
  it('removes in the middle', () => {
    expect(removeItem(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  })
  it('returns null when index is out of bounds (< 0)', () => {
    expect(removeItem(['a'], -1)).toBeNull()
  })
  it('returns null when index is out of bounds (>= length)', () => {
    expect(removeItem(['a'], 1)).toBeNull()
  })
  it('returns null on empty array', () => {
    expect(removeItem([], 0)).toBeNull()
  })
  it('does not mutate the original array', () => {
    const original = ['a', 'b', 'c']
    removeItem(original, 1)
    expect(original).toEqual(['a', 'b', 'c'])
  })
})

describe('swapItems', () => {
  it('swaps two valid indices', () => {
    expect(swapItems(['a', 'b', 'c'], 0, 2)).toEqual(['c', 'b', 'a'])
  })
  it('returns null when first index is out of bounds', () => {
    expect(swapItems(['a'], -1, 0)).toBeNull()
  })
  it('returns null when second index is out of bounds', () => {
    expect(swapItems(['a'], 0, 1)).toBeNull()
  })
  it('returns null on empty array', () => {
    expect(swapItems([], 0, 0)).toBeNull()
  })
  it('does not mutate the original array', () => {
    const original = ['a', 'b', 'c']
    swapItems(original, 0, 2)
    expect(original).toEqual(['a', 'b', 'c'])
  })
})

describe('moveItem', () => {
  it('moves an item forward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })
  it('moves an item backward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })
  it('moves to the same position (no-op)', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })
  it('returns null when from index is out of bounds', () => {
    expect(moveItem(['a'], -1, 0)).toBeNull()
  })
  it('returns null when to index is out of bounds', () => {
    expect(moveItem(['a'], 0, 5)).toBeNull()
  })
  it('does not mutate the original array', () => {
    const original = ['a', 'b', 'c']
    moveItem(original, 0, 2)
    expect(original).toEqual(['a', 'b', 'c'])
  })
})

describe('insertRemap', () => {
  it('shifts elements at or after the insertion point forward by 1', () => {
    const fn = insertRemap(2)
    expect(fn(0)).toBe(0)
    expect(fn(1)).toBe(1)
    expect(fn(2)).toBe(3)
    expect(fn(3)).toBe(4)
  })
})

describe('removeRemap', () => {
  it('removes the element at the index and shifts others back', () => {
    const fn = removeRemap(2)
    expect(fn(0)).toBe(0)
    expect(fn(1)).toBe(1)
    expect(fn(2)).toBe(null) // removed
    expect(fn(3)).toBe(2)
    expect(fn(4)).toBe(3)
  })
})

describe('swapRemap', () => {
  it('maps swapped indices correctly', () => {
    const fn = swapRemap(1, 3)
    expect(fn(0)).toBe(0)
    expect(fn(1)).toBe(3)
    expect(fn(2)).toBe(2)
    expect(fn(3)).toBe(1)
    expect(fn(4)).toBe(4)
  })
})

describe('moveRemap', () => {
  it('maps forward move correctly (0→2)', () => {
    const fn = moveRemap(0, 2)
    expect(fn(0)).toBe(2)
    expect(fn(1)).toBe(0) // shifted back
    expect(fn(2)).toBe(1)
    expect(fn(3)).toBe(3)
  })

  it('maps backward move correctly (3→1)', () => {
    const fn = moveRemap(3, 1)
    expect(fn(0)).toBe(0)
    expect(fn(1)).toBe(2) // shifted up by 1
    expect(fn(2)).toBe(3) // shifted up by 1
    expect(fn(3)).toBe(1) // moved to position 1
    expect(fn(4)).toBe(4)
  })

  it('same-from-to is identity (no-op)', () => {
    const fn = moveRemap(2, 2)
    expect(fn(0)).toBe(0)
    expect(fn(1)).toBe(1)
    expect(fn(2)).toBe(2)
    expect(fn(3)).toBe(3)
  })
})

describe('rekeyMetadata — integration', () => {
  it('re-maps per-element metadata after an array mutation', () => {
    const before = {
      errors: {
        'items[0].name': 'Req',
        'items[1].name': 'Too long',
        'items[2].name': undefined,
      } as Record<string, string | undefined>,
      touched: { 'items[0].name': true, 'items[1].name': false, 'items[2].name': true } as Record<
        string,
        boolean | undefined
      >,
      dirty: { 'items[0].name': true, 'items[1].name': true, 'items[2].name': false } as Record<
        string,
        boolean | undefined
      >,
      validating: {
        'items[0].name': false,
        'items[1].name': false,
        'items[2].name': false,
      } as Record<string, boolean | undefined>,
    }

    // Remove item at index 1 → items[2] shifts to index 1
    const result = rekeyMetadata(before, 'items', removeRemap(1))

    expect(result.errors).toEqual({ 'items[0].name': 'Req', 'items[1].name': undefined })
    expect(result.touched).toEqual({ 'items[0].name': true, 'items[1].name': true })
    expect(result.dirty).toEqual({ 'items[0].name': true, 'items[1].name': false })
    expect(result.validating).toEqual({ 'items[0].name': false, 'items[1].name': false })
  })

  it('returns empty metadata when input is empty', () => {
    const result = rekeyMetadata(
      { errors: {}, touched: {}, dirty: {}, validating: {} },
      'items',
      removeRemap(0),
    )
    expect(result.errors).toEqual({})
    expect(result.touched).toEqual({})
    expect(result.dirty).toEqual({})
    expect(result.validating).toEqual({})
  })
})
