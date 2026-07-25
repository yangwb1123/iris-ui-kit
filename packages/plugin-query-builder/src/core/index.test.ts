import { describe, it, expect, vi } from 'vitest'
import { runPlugins } from '@iris-ui/core'
import {
  createFilterBuilder,
  operatorsByType,
  queryBuilderPlugin,
  queryBuilderTokens,
  type QueryColumn,
} from './index'

const columns: QueryColumn[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'age', label: 'Age', type: 'number' },
  { key: 'role', label: 'Role', type: 'enum', options: [{ label: 'Admin', value: 'admin' }] },
]

describe('createFilterBuilder', () => {
  it('addRule appends a rule defaulting to the first column + its first operator', () => {
    const b = createFilterBuilder({ columns })
    b.addRule()
    const [rule] = b.getState().rules
    expect(rule?.key).toBe('name')
    expect(rule?.operator).toBe('contains') // string's first operator
    expect(rule?.value).toBe('')
  })

  it('operatorsFor returns the operators for a column type', () => {
    const b = createFilterBuilder({ columns })
    expect(b.operatorsFor('age')).toEqual(operatorsByType.number)
    expect(b.operatorsFor('nope')).toEqual([])
  })

  it('switching a rule to a column of a different type resets the operator', () => {
    const b = createFilterBuilder({ columns })
    b.addRule()
    const id = b.getState().rules[0]!.id
    b.updateRule(id, { operator: 'startsWith' })
    b.updateRule(id, { key: 'age' }) // number — 'startsWith' is invalid
    expect(b.getState().rules[0]!.operator).toBe(operatorsByType.number[0]) // reset to 'eq'
  })

  it('removeRule + clear', () => {
    const b = createFilterBuilder({ columns })
    b.addRule()
    b.addRule()
    const id = b.getState().rules[0]!.id
    b.removeRule(id)
    expect(b.getState().rules).toHaveLength(1)
    b.clear()
    expect(b.getState().rules).toHaveLength(0)
  })

  it('toFilterRules drops incomplete rows + coerces per type/operator', () => {
    const b = createFilterBuilder({
      columns,
      initialRules: [
        { key: 'name', operator: 'contains', value: 'ad' },
        { key: 'age', operator: 'gte', value: '30' },
        { key: 'age', operator: 'between', value: '20, 40' },
        { key: 'role', operator: 'in', value: 'admin, editor' },
        { key: 'name', operator: 'eq', value: '   ' }, // empty → dropped
      ],
    })
    expect(b.toFilterRules()).toEqual([
      { key: 'name', operator: 'contains', value: 'ad' },
      { key: 'age', operator: 'gte', value: 30 },
      { key: 'age', operator: 'between', value: [20, 40] },
      { key: 'role', operator: 'in', value: ['admin', 'editor'] },
    ])
  })

  it('plugin registers its tokens', () => {
    const { tokens } = runPlugins([queryBuilderPlugin])
    expect(tokens['--iris-query-builder-gap']).toBe(queryBuilderTokens['--iris-query-builder-gap'])
  })

  it('subscribe fires on rule changes', () => {
    const b = createFilterBuilder({ columns })
    const listener = vi.fn()
    b.subscribe(listener)
    b.addRule()
    expect(listener).toHaveBeenCalled()
  })

  it('updateRule with value updates the rule', () => {
    const b = createFilterBuilder({ columns })
    b.addRule()
    const id = b.getState().rules[0]!.id
    b.updateRule(id, { value: 'test' })
    expect(b.getState().rules[0]?.value).toBe('test')
  })

  it('columnFor returns a column by key', () => {
    const b = createFilterBuilder({ columns })
    expect(b.columnFor('name')?.type).toBe('string')
    expect(b.columnFor('nope')).toBeUndefined()
  })

  it('initialRules seeds the builder', () => {
    const b = createFilterBuilder({
      columns,
      initialRules: [{ key: 'name', operator: 'contains', value: 'ada' }],
    })
    expect(b.getState().rules).toHaveLength(1)
    expect(b.getState().rules[0]?.value).toBe('ada')
  })

  it('empty columns still creates a builder', () => {
    const b = createFilterBuilder({ columns: [] })
    expect(b.getState().rules).toEqual([])
  })
})
