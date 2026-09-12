import { describe, expect, it } from 'vitest'
import { createFlatRowIndex } from './grid-rows-index'

describe('createFlatRowIndex', () => {
  it('indexes complete stable keys with SameValueZero semantics', () => {
    const nanRow = { id: Number.NaN }
    const rows = [{ id: 1 }, { id: 'two' }, nanRow]
    const index = createFlatRowIndex(rows, 'id')

    expect(index.usable).toBe(true)
    expect(index.get(1)?.row).toBe(rows[0])
    expect(index.get('two')?.index).toBe(1)
    expect(index.get(Number.NaN)?.row).toBe(nanRow)
    expect(index.get(-0)).toBeUndefined()
  })

  it('falls back when keys are missing or duplicated', () => {
    const duplicate = createFlatRowIndex([{ id: 1 }, { id: 1 }], 'id')
    const missing = createFlatRowIndex([{ id: 1 }, { name: 'unkeyed' }], 'id')

    expect(duplicate.usable).toBe(false)
    expect(duplicate.get(1)).toBeUndefined()
    expect(missing.usable).toBe(false)
    expect(missing.get(1)).toBeUndefined()
  })
})
