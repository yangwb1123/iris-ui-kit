import { describe, it, expect, vi } from 'vitest'
import { runPlugins } from '@iris-ui-kit/core'
import {
  MAX_QUERY_DEPTH,
  compileQuery,
  createFilterBuilder,
  deserializeQuery,
  filterByQuery,
  matchesQuery,
  normalizeQuery,
  operatorsByType,
  queryBuilderPlugin,
  queryBuilderTokens,
  serializeQuery,
  validateQuery,
  type QueryGroup,
  type QueryColumn,
} from './index'

const columns: QueryColumn[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'age', label: 'Age', type: 'number' },
  { key: 'role', label: 'Role', type: 'enum', options: [{ label: 'Admin', value: 'admin' }] },
  { key: 'created', label: 'Created', type: 'date' },
  { key: 'active', label: 'Active', type: 'boolean' },
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

  it('keeps the legacy root rules projection while editing nested groups', () => {
    const b = createFilterBuilder({ columns })
    const rootRule = b.addRule()
    const groupId = b.addGroup(undefined, 'or')
    const nestedRule = b.addRule(groupId)

    expect(b.getState().rules.map((rule) => rule.id)).toEqual([rootRule])
    expect(b.getState().root.children).toHaveLength(2)
    const group = b.getState().root.children[1]
    expect(group).toMatchObject({ type: 'group', id: groupId, combinator: 'or' })
    if (group?.type !== 'group') throw new Error('expected a group')
    expect(group.children[0]?.id).toBe(nestedRule)

    b.updateGroup(groupId, { combinator: 'and' })
    expect((b.getState().root.children[1] as QueryGroup).combinator).toBe('and')
    b.removeRule(nestedRule)
    expect((b.getState().root.children[1] as QueryGroup).children).toEqual([])
    b.removeGroup(groupId)
    expect(b.getState().root.children.map((node) => node.id)).toEqual([rootRule])
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

  it('coerces boolean values and preserves recursive AND/OR compilation', () => {
    const b = createFilterBuilder({
      columns,
      initialQuery: {
        id: 'root',
        combinator: 'and',
        children: [
          { id: 'age-rule', key: 'age', operator: 'gte', value: '18' },
          {
            type: 'group',
            id: 'choice',
            combinator: 'or',
            children: [
              { id: 'role-rule', key: 'role', operator: 'eq', value: 'admin' },
              { id: 'active-rule', key: 'active', operator: 'eq', value: 'true' },
            ],
          },
        ],
      },
    })

    expect(b.toQuery()).toEqual({
      type: 'group',
      id: 'root',
      combinator: 'and',
      children: [
        {
          type: 'rule',
          id: 'age-rule',
          key: 'age',
          operator: 'gte',
          value: 18,
        },
        {
          type: 'group',
          id: 'choice',
          combinator: 'or',
          children: [
            {
              type: 'rule',
              id: 'role-rule',
              key: 'role',
              operator: 'eq',
              value: 'admin',
            },
            {
              type: 'rule',
              id: 'active-rule',
              key: 'active',
              operator: 'eq',
              value: true,
            },
          ],
        },
      ],
    })

    expect(b.matches({ age: 20, role: 'member', active: true })).toBe(true)
    expect(b.matches({ age: 20, role: 'member', active: false })).toBe(false)
    expect(b.matches({ age: 15, role: 'admin', active: true })).toBe(false)
    expect(
      b.filter([
        { age: 20, role: 'member', active: true },
        { age: 20, role: 'member', active: false },
      ]),
    ).toEqual([{ age: 20, role: 'member', active: true }])
  })

  it('replaceQuery normalizes unknown input and clear preserves the root identity', () => {
    const b = createFilterBuilder({ columns })
    const originalRoot = b.getState().root.id
    b.replaceQuery({
      id: 'saved-root',
      combinator: 'or',
      children: [{ id: 'saved-rule', key: 'name', operator: 'contains', value: 'iris' }],
    })
    expect(b.getState().root.id).toBe('saved-root')
    b.clear()
    expect(b.getState().root).toMatchObject({
      id: 'saved-root',
      combinator: 'or',
      children: [],
    })
    expect(originalRoot).not.toBe('')
  })

  it('plugin registers its tokens', () => {
    const { tokens } = runPlugins([queryBuilderPlugin])
    // No render-layer consumers → no dead token registrations (§6c).
    expect(tokens['--iris-query-builder-gap']).toBeUndefined()
    expect(queryBuilderTokens).toEqual({})
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

describe('recursive query AST boundaries', () => {
  it('normalizes stable ids and repairs duplicate/unsafe ids', () => {
    const normalized = normalizeQuery(
      {
        type: 'group',
        id: 'root',
        combinator: 'or',
        children: [
          { type: 'rule', id: 'same', key: 'name', operator: 'contains', value: 'a' },
          { type: 'rule', id: 'same', key: 'age', operator: 'gte', value: 18 },
          {
            type: 'group',
            id: '<unsafe>',
            combinator: 'not-valid',
            children: [],
          },
        ],
      },
      columns,
    )
    const ids = [normalized.id, ...normalized.children.map((node) => node.id)]
    expect(normalized.id).toBe('root')
    expect(normalized.combinator).toBe('or')
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(id))).toBe(true)
    expect(normalized.children[1]).toMatchObject({ key: 'age', value: '18' })
    expect(normalized.children[2]).toMatchObject({ type: 'group', combinator: 'and' })
  })

  it('bounds hostile recursive input without throwing', () => {
    let nested: Record<string, unknown> = {
      type: 'group',
      id: 'leaf',
      combinator: 'and',
      children: [],
    }
    for (let index = 0; index < MAX_QUERY_DEPTH + 10; index += 1) {
      nested = {
        type: 'group',
        id: `group-${index}`,
        combinator: 'and',
        children: [nested],
      }
    }
    const normalized = normalizeQuery(nested, columns)
    let depth = 0
    let cursor = normalized
    while (cursor.children[0]?.type === 'group') {
      depth += 1
      cursor = cursor.children[0]
    }
    expect(depth).toBeLessThanOrEqual(MAX_QUERY_DEPTH)
  })

  it('reports duplicate ids, fields, operators and typed value errors', () => {
    const invalid = {
      type: 'group',
      id: 'root',
      combinator: 'and',
      children: [
        { type: 'rule', id: 'duplicate', key: 'missing', operator: 'eq', value: 'x' },
        { type: 'rule', id: 'duplicate', key: 'age', operator: 'contains', value: 'x' },
        { type: 'rule', id: 'date-rule', key: 'created', operator: 'eq', value: 'not-date' },
        { type: 'rule', id: 'bool-rule', key: 'active', operator: 'eq', value: 'maybe' },
        { type: 'rule', id: 'range-rule', key: 'age', operator: 'between', value: '1' },
        { type: 'rule', id: 'empty-rule', key: 'name', operator: 'contains', value: '   ' },
      ],
    }
    const result = validateQuery(invalid, columns)
    expect(result.valid).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'unknown-field',
        'duplicate-id',
        'invalid-operator',
        'invalid-value',
        'missing-value',
      ]),
    )
    expect(result.issues.every((issue) => Array.isArray(issue.path))).toBe(true)
  })

  it('serializes/deserializes the editable AST and recovers from corrupt JSON', () => {
    const query = normalizeQuery(
      {
        id: 'root',
        combinator: 'or',
        children: [{ id: 'rule-one', key: 'name', operator: 'eq', value: 'Iris' }],
      },
      columns,
    )
    const serialized = serializeQuery(query)
    expect(deserializeQuery(serialized, columns)).toEqual(query)
    const empty = deserializeQuery('{not-json', columns)
    expect(empty.type).toBe('group')
    expect(empty.children).toEqual([])
  })

  it('drops incomplete leaves during compile and evaluates nested queries directly', () => {
    const query = normalizeQuery(
      {
        id: 'root',
        combinator: 'or',
        children: [
          { id: 'empty', key: 'name', operator: 'contains', value: '' },
          {
            type: 'group',
            id: 'nested',
            combinator: 'and',
            children: [
              { id: 'age', key: 'age', operator: 'between', value: '18, 30' },
              { id: 'name', key: 'name', operator: 'startsWith', value: 'A' },
            ],
          },
        ],
      },
      columns,
    )
    const compiled = compileQuery(query, columns)
    expect(compiled.children).toHaveLength(1)
    expect(matchesQuery({ age: 25, name: 'Ada' }, compiled)).toBe(true)
    expect(matchesQuery({ age: 40, name: 'Ada' }, compiled)).toBe(false)
    expect(
      filterByQuery(
        [
          { profile: { age: 25 }, name: 'Ada' },
          { profile: { age: 40 }, name: 'Ada' },
        ],
        compiled,
        (row, key) => (key === 'age' ? row.profile.age : row.name),
      ),
    ).toHaveLength(1)
  })
})
