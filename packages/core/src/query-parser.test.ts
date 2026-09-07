import { describe, expect, it } from 'vitest'
import { parseTableQuery, type ParsedTableQuery } from './query-parser'

const FIELDS = ['name', 'age', 'role']

function parse(query: string, fields?: string[]): ParsedTableQuery {
  return parseTableQuery(query, fields ? { fields } : undefined)
}

describe('parseTableQuery — empty input', () => {
  it('returns an empty result with no error for ""', () => {
    const r = parse('')
    expect(r.error).toBeNull()
    expect(r.filters).toEqual({})
    expect(r.inValues).toEqual({})
    expect(r.rules).toEqual([])
    expect(r.sort).toBeNull()
  })

  it('tolerates whitespace-only queries', () => {
    const r = parse('   \n\t ')
    expect(r.error).toBeNull()
    expect(r.filters).toEqual({})
    expect(r.rules).toEqual([])
  })

  it('does not share mutable empty or error snapshots', () => {
    const empty = parse('')
    empty.filters.leaked = 'value'
    empty.inValues.leaked = ['value']
    empty.rules.push({ key: 'leaked', operator: 'gt', value: 1 })

    const nextEmpty = parse('')
    expect(nextEmpty).toEqual({ filters: {}, inValues: {}, rules: [], sort: null, error: null })

    const error = parse('not a clause')
    error.filters.leaked = 'value'
    error.inValues.leaked = ['value']
    error.rules.push({ key: 'leaked', operator: 'gt', value: 1 })
    const nextError = parse('not a clause')
    expect(nextError.filters).toEqual({})
    expect(nextError.inValues).toEqual({})
    expect(nextError.rules).toEqual([])
    expect(nextError.error).not.toBeNull()
  })
})

describe('parseTableQuery — runtime input hardening', () => {
  it('fails closed instead of throwing for malformed runtime inputs', () => {
    expect(() => parseTableQuery(null as unknown as string)).not.toThrow()
    expect(parseTableQuery(null as unknown as string).error).toBe('Invalid query')
    expect(() =>
      parseTableQuery('age > 1', { fields: [null] as unknown as string[] }),
    ).not.toThrow()
    expect(parseTableQuery('age > 1', { fields: [null] as unknown as string[] }).error).toBe(
      'Invalid query fields',
    )
    expect(() => parseTableQuery('age > 1', 1 as unknown as { fields?: string[] })).not.toThrow()
    expect(parseTableQuery('age > 1', null as unknown as { fields?: string[] }).error).toBe(
      'Invalid query options',
    )
  })
})

describe('parseTableQuery — comparison operators', () => {
  it('parses `=` into the substring filters channel', () => {
    const r = parse('role = Test', FIELDS)
    expect(r.error).toBeNull()
    expect(r.filters).toEqual({ role: 'Test' })
  })

  it('parses `>` into a numeric gt rule', () => {
    const r = parse('age > 25', FIELDS)
    expect(r.error).toBeNull()
    expect(r.rules).toEqual([{ key: 'age', operator: 'gt', value: 25 }])
  })

  it('parses `>=` / `<` / `<=` / `!=` into typed rules', () => {
    expect(parse('age >= 30', FIELDS).rules).toEqual([{ key: 'age', operator: 'gte', value: 30 }])
    expect(parse('age < 30', FIELDS).rules).toEqual([{ key: 'age', operator: 'lt', value: 30 }])
    expect(parse('age <= 30', FIELDS).rules).toEqual([{ key: 'age', operator: 'lte', value: 30 }])
    expect(parse('role != Test', FIELDS).rules).toEqual([
      { key: 'role', operator: 'ne', value: 'Test' },
    ])
  })

  it('parses `contains` into the substring filters channel', () => {
    const r = parse('name contains al', FIELDS)
    expect(r.error).toBeNull()
    expect(r.filters).toEqual({ name: 'al' })
  })

  it('supports operators without surrounding whitespace', () => {
    expect(parse('age>=25', FIELDS).rules).toEqual([{ key: 'age', operator: 'gte', value: 25 }])
    expect(parse('role=Test', FIELDS).filters).toEqual({ role: 'Test' })
  })
})

describe('parseTableQuery — quoted values', () => {
  it('unquotes single-quoted values', () => {
    const r = parse("role = 'Test'", FIELDS)
    expect(r.filters).toEqual({ role: 'Test' })
  })

  it('unquotes double-quoted values with spaces', () => {
    const r = parse('name = "John Smith"', FIELDS)
    expect(r.filters).toEqual({ name: 'John Smith' })
  })

  it('keeps quoted numerics as strings in relational rules', () => {
    const r = parse('age > "25"', FIELDS)
    expect(r.rules).toEqual([{ key: 'age', operator: 'gt', value: '25' }])
  })

  it('errors on an unterminated quote', () => {
    const r = parse("role = 'Test", FIELDS)
    expect(r.error).not.toBeNull()
    expect(r.filters).toEqual({})
  })

  it('rejects an unmatched quote even when it is not the value prefix', () => {
    expect(parse("name = John's and age > 1", FIELDS).error).not.toBeNull()
  })
})

describe('parseTableQuery — in-lists', () => {
  it('parses `in (a, b, c)` into inValues', () => {
    const r = parse('role in (Test, PM)', FIELDS)
    expect(r.error).toBeNull()
    expect(r.inValues).toEqual({ role: ['Test', 'PM'] })
  })

  it('tolerates missing spaces and quoted list values', () => {
    const r = parse('role in (Test,\'PM\', "QA Lead")', FIELDS)
    expect(r.inValues).toEqual({ role: ['Test', 'PM', 'QA Lead'] })
  })

  it('keeps commas inside quoted list values', () => {
    const r = parse('role in ("a,b", c)', FIELDS)
    expect(r.inValues).toEqual({ role: ['a,b', 'c'] })
  })

  it('errors when the list is not parenthesized', () => {
    const r = parse('role in Test, PM', FIELDS)
    expect(r.error).not.toBeNull()
  })

  it('errors on an empty in-list', () => {
    const r = parse('role in ()', FIELDS)
    expect(r.error).not.toBeNull()
  })

  it('rejects repeated in-lists joined by AND instead of dropping one', () => {
    const r = parse('role in (Test) and role in (PM)', FIELDS)
    expect(r.error).not.toBeNull()
    expect(r.inValues).toEqual({})
  })
})

describe('parseTableQuery — sort clause', () => {
  it('parses a trailing `sort by field asc`', () => {
    const r = parse('age > 25 sort by name asc', FIELDS)
    expect(r.error).toBeNull()
    expect(r.sort).toEqual({ key: 'name', direction: 'asc' })
    expect(r.rules).toEqual([{ key: 'age', operator: 'gt', value: 25 }])
  })

  it('parses desc and defaults to asc', () => {
    expect(parse('sort by age desc', FIELDS).sort).toEqual({ key: 'age', direction: 'desc' })
    expect(parse('sort by name', FIELDS).sort).toEqual({ key: 'name', direction: 'asc' })
  })

  it('rejects a sort clause that is not last', () => {
    const r = parse('age > 25 sort by name asc and role = Test', FIELDS)
    expect(r.error).not.toBeNull()
  })

  it('rejects an invalid sort direction', () => {
    const r = parse('sort by name sideways', FIELDS)
    expect(r.error).not.toBeNull()
  })

  it('rejects a sort clause without a field', () => {
    expect(parse('sort by', FIELDS).error).not.toBeNull()
    expect(parse('sort by').error).not.toBeNull()
  })

  it('rejects a dangling or repeated boolean separator', () => {
    expect(parse('role = Test or', FIELDS).error).not.toBeNull()
    expect(parse('and role = Test', FIELDS).error).not.toBeNull()
    expect(parse('age > 25 and and role = Test', FIELDS).error).not.toBeNull()
  })

  it('rejects nested or trailing syntax after an in-list', () => {
    expect(parse('role in (a) in (b)', FIELDS).error).not.toBeNull()
    expect(parse('role in (a,)', FIELDS).error).not.toBeNull()
  })

  it('rejects unbalanced parentheses outside the list grammar', () => {
    expect(parse('age > 1)', FIELDS).error).not.toBeNull()
    expect(parse('age > (1', FIELDS).error).not.toBeNull()
  })
})

describe('parseTableQuery — AND / OR', () => {
  it('ANDs clauses across channels', () => {
    const r = parse('age > 25 and role = Test', FIELDS)
    expect(r.error).toBeNull()
    expect(r.rules).toEqual([{ key: 'age', operator: 'gt', value: 25 }])
    expect(r.filters).toEqual({ role: 'Test' })
  })

  it('folds same-field `=` OR into inValues (OR-match)', () => {
    const r = parse('role = Test or role = PM', FIELDS)
    expect(r.error).toBeNull()
    expect(r.filters).toEqual({})
    expect(r.inValues).toEqual({ role: ['Test', 'PM'] })
  })

  it('folds a three-way same-field `=` OR', () => {
    const r = parse('role = Test or role = PM or role = Dev', FIELDS)
    expect(r.inValues).toEqual({ role: ['Test', 'PM', 'Dev'] })
  })

  it('merges same-field `in` OR lists', () => {
    const r = parse('role in (Test) or role in (PM, Dev)', FIELDS)
    expect(r.inValues).toEqual({ role: ['Test', 'PM', 'Dev'] })
  })

  it('merges `=` OR `in` on the same field', () => {
    const r = parse('role = Test or role in (PM)', FIELDS)
    expect(r.inValues).toEqual({ role: ['Test', 'PM'] })
  })

  it('errors on same-field `contains` OR (fail closed)', () => {
    const r = parse('name contains al or name contains bo', FIELDS)
    expect(r.error).not.toBeNull()
  })

  it('errors on same-field relational OR', () => {
    const r = parse('age > 25 or age < 10', FIELDS)
    expect(r.error).not.toBeNull()
  })

  it('normalizes cross-field OR to AND', () => {
    const r = parse('age > 25 or role = Test', FIELDS)
    expect(r.error).toBeNull()
    expect(r.rules).toEqual([{ key: 'age', operator: 'gt', value: 25 }])
    expect(r.filters).toEqual({ role: 'Test' })
  })

  it('rejects repeated text filters joined by AND instead of dropping one', () => {
    expect(parse('role = Test and role = PM', FIELDS).error).not.toBeNull()
    expect(parse('name contains a and name contains b', FIELDS).error).not.toBeNull()
  })

  it('does not lose a later same-channel clause after a cross-field OR', () => {
    expect(parse('role = Test or age > 25 or role = PM', FIELDS).error).not.toBeNull()
  })
})

describe('parseTableQuery — field safety and numeric coercion', () => {
  it('preserves prototype-sensitive field names as own data properties', () => {
    const text = parse('__proto__ = value', undefined)
    expect(Object.prototype.hasOwnProperty.call(text.filters, '__proto__')).toBe(true)
    expect(text.filters['__proto__']).toBe('value')
    expect(Object.getPrototypeOf(text.filters)).toBe(Object.prototype)

    const list = parse('constructor in (value)', undefined)
    expect(list.error).toBeNull()
    expect(list.inValues.constructor).toEqual(['value'])
  })

  it('keeps overflowing numeric-looking relational values finite', () => {
    const value = '9'.repeat(400)
    const r = parse(`age > ${value}`, FIELDS)
    expect(r.error).toBeNull()
    expect(r.rules).toEqual([{ key: 'age', operator: 'gt', value }])
  })
})

describe('parseTableQuery — field validation & casing', () => {
  it('matches fields case-insensitively and reports the canonical key', () => {
    const r = parse('AGE > 25', FIELDS)
    expect(r.rules).toEqual([{ key: 'age', operator: 'gt', value: 25 }])
    expect(parse('Role = Test', FIELDS).filters).toEqual({ role: 'Test' })
  })

  it('resolves case-insensitive duplicate field names deterministically', () => {
    expect(parse('NAME = Alice', ['Name', 'name', 'age']).filters).toEqual({ Name: 'Alice' })
  })

  it('errors on an unknown field when fields are given', () => {
    const r = parse('salary > 100', FIELDS)
    expect(r.error).not.toBeNull()
  })

  it('accepts unknown fields when no fields are given', () => {
    const r = parse('salary > 100')
    expect(r.error).toBeNull()
    expect(r.rules).toEqual([{ key: 'salary', operator: 'gt', value: 100 }])
  })

  it('errors on a clause with no operator', () => {
    const r = parse('just a word', FIELDS)
    expect(r.error).not.toBeNull()
  })
})

describe('parseTableQuery — whitespace tolerance', () => {
  it('tolerates extra whitespace around operators and clauses', () => {
    const r = parse('  age   >   25   and   role  =  Test  ', FIELDS)
    expect(r.error).toBeNull()
    expect(r.rules).toEqual([{ key: 'age', operator: 'gt', value: 25 }])
    expect(r.filters).toEqual({ role: 'Test' })
  })

  it('treats and/or keywords case-insensitively', () => {
    const r = parse('age > 25 AND role = Test OR role = PM', FIELDS)
    expect(r.error).toBeNull()
    expect(r.inValues).toEqual({ role: ['Test', 'PM'] })
    expect(r.rules).toEqual([{ key: 'age', operator: 'gt', value: 25 }])
  })

  it('does not split on `and`/`or` inside values or quotes', () => {
    expect(parse('role in (A and B, C)', FIELDS).inValues).toEqual({ role: ['A and B', 'C'] })
    expect(parse('name = "and or"', FIELDS).filters).toEqual({ name: 'and or' })
  })

  it('parses decimal and negative numeric values', () => {
    expect(parse('age > 25.5', FIELDS).rules).toEqual([{ key: 'age', operator: 'gt', value: 25.5 }])
    expect(parse('age > -3', FIELDS).rules).toEqual([{ key: 'age', operator: 'gt', value: -3 }])
  })
})
