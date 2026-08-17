import { describe, it, expect } from 'vitest'
import {
  validateEditRules,
  validateEditRulesAsync,
  type EditRule,
  type EditRuleResult,
} from './edit-rules'

describe('validateEditRules (vxe editRules parity)', () => {
  it('required: rejects empty string/undefined/null, accepts values', () => {
    const rules: EditRule[] = [{ required: true, message: '必填' }]
    expect(validateEditRules(rules, '', {}).messages).toEqual(['必填'])
    expect(validateEditRules(rules, '   ', {}).valid).toBe(false)
    expect(validateEditRules(rules, undefined, {}).valid).toBe(false)
    expect(validateEditRules(rules, 'a', {}).valid).toBe(true)
  })

  it('min/max: string length and numeric value', () => {
    expect(validateEditRules([{ min: 3 }], 'ab', {}).valid).toBe(false)
    expect(validateEditRules([{ max: 3 }], 'abcd', {}).valid).toBe(false)
    expect(validateEditRules([{ min: 10, max: 20 }], 5, {}).valid).toBe(false)
    expect(validateEditRules([{ min: 10, max: 20 }], 15, {}).valid).toBe(true)
  })

  it('type: number/string/array', () => {
    expect(validateEditRules([{ type: 'number' }], 'x', {}).valid).toBe(false)
    expect(validateEditRules([{ type: 'number' }], 42, {}).valid).toBe(true)
    expect(validateEditRules([{ type: 'array' }], 'x', {}).valid).toBe(false)
    expect(validateEditRules([{ type: 'array' }], [1], {}).valid).toBe(true)
  })

  it('pattern: regex matching on string value', () => {
    expect(validateEditRules([{ pattern: /^\d+$/ }], 'abc', {}).valid).toBe(false)
    expect(validateEditRules([{ pattern: /^\d+$/ }], '123', {}).valid).toBe(true)
  })

  it('regexp: RegExp match/reject (pattern shorthand)', () => {
    expect(validateEditRules([{ regexp: /^[a-z]+$/ }], 'abc', {}).valid).toBe(true)
    expect(validateEditRules([{ regexp: /^[a-z]+$/ }], 'ABC1', {}).valid).toBe(false)
    expect(validateEditRules([{ regexp: /^\d+$/ }], '123', {}).messages).toEqual([])
    expect(validateEditRules([{ regexp: /^\d+$/ }], '12a3', {}).valid).toBe(false)
  })

  it('regexp: string source compiles + message override + empty exempt', () => {
    expect(validateEditRules([{ regexp: '^\\d{4}$', message: '格式错' }], '1234', {}).valid).toBe(
      true,
    )
    expect(
      validateEditRules([{ regexp: '^\\d{4}$', message: '格式错' }], '12', {}).messages,
    ).toEqual(['格式错'])
    // Empty values stay exempt, matching pattern semantics.
    expect(validateEditRules([{ regexp: '^\\d{4}$' }], '', {}).valid).toBe(true)
  })

  it('regexp: pattern takes precedence when both set (pattern wins)', () => {
    const r = validateEditRules(
      [{ pattern: /^[a-z]+$/, regexp: /^\d+$/, message: '格式' }],
      '123',
      {},
    )
    expect(r.valid).toBe(false)
    expect(r.messages).toEqual(['格式'])
    expect(validateEditRules([{ pattern: /^[a-z]+$/, regexp: /^\d+$/ }], 'abc', {}).valid).toBe(
      true,
    )
  })

  it('regexp: flows through the async API (real table commit route)', async () => {
    const r = await validateEditRulesAsync([{ regexp: /^\d+$/ }], '12a', {})
    expect(r).toMatchObject({ valid: false, messages: ['Value format is invalid'] })
    expect(await validateEditRulesAsync([{ regexp: /^\d+$/ }], '123', {})).toMatchObject({
      valid: true,
    })
  })

  it('validator: sync string return rejects; null accepts', () => {
    const rules: EditRule[] = [{ validator: (v) => (v === 'no' ? '不能是 no' : null) }]
    expect(validateEditRules(rules, 'no', {}).messages).toEqual(['不能是 no'])
    expect(validateEditRules(rules, 'yes', {}).valid).toBe(true)
  })

  it('collectAll returns every failing message', () => {
    const rules: EditRule[] = [
      { required: true, message: '必填' },
      { pattern: 'x', message: '格式' },
    ]
    const r = validateEditRules(rules, 'y', {}, true)
    expect(r.messages).toEqual(['格式'])
  })

  it('async validator resolves via async API', async () => {
    const rules: EditRule[] = [{ validator: async (v) => (v === 'dup' ? '重复' : null) }]
    expect(await validateEditRulesAsync(rules, 'dup', {})).toMatchObject({
      valid: false,
      messages: ['重复'],
    })
    expect(await validateEditRulesAsync(rules, 'ok', {})).toMatchObject({ valid: true })
  })
})

describe('validateEditRules unique rule (batch AK)', () => {
  interface Row {
    name?: string
  }

  const rows: Row[] = [{ name: 'a' }, { name: 'b' }]
  const ctx = { rows, columnKey: 'name' }
  // Unique is a row-scoped rule: the context is the OPTIONAL 5th argument
  // (after `collectAll`) — callers must pass `false` to reach it.
  const withCtx = (v: unknown, r: Row): EditRuleResult =>
    validateEditRules([{ unique: true }], v, r, false, ctx)

  it('first use passes; duplicate fails with the default message', () => {
    expect(withCtx('a', rows[0]!).valid).toBe(true)
    expect(withCtx('b', rows[1]!).valid).toBe(true)
    const r = withCtx('a', rows[1]!)
    expect(r.valid).toBe(false)
    expect(r.messages).toEqual(['Value must be unique'])
  })

  it('rule message overrides the default', () => {
    const r = validateEditRules([{ unique: true, message: '名称重复' }], 'a', rows[1]!, false, ctx)
    expect(r.messages).toEqual(['名称重复'])
  })

  it('empty values are not duplicates (either side)', () => {
    const withEmpty: Row[] = [{ name: 'a' }, { name: '' }, { name: undefined }]
    const c = { rows: withEmpty, columnKey: 'name' }
    // Empty draft values never run the unique check.
    expect(validateEditRules([{ unique: true }], '', withEmpty[1]!, false, c).valid).toBe(true)
    expect(validateEditRules([{ unique: true }], '', withEmpty[2]!, false, c).valid).toBe(true)
    // Empty OTHER-row values never collide: 'b' matches no non-empty value.
    expect(validateEditRules([{ unique: true }], 'b', withEmpty[2]!, false, c).valid).toBe(true)
    // 'a' still duplicates row 0's non-empty value (rows 1–2 are exempt).
    expect(validateEditRules([{ unique: true }], 'a', withEmpty[2]!, false, c).valid).toBe(false)
  })

  it('combines with required/pattern', () => {
    const rules: EditRule[] = [
      { required: true, message: '必填' },
      { unique: true },
      { pattern: /^[a-z]+$/, message: '格式' },
    ]
    // Empty fails required first.
    expect(validateEditRules(rules, '', rows[0]!, false, ctx).messages).toEqual(['必填'])
    // Duplicate fails unique.
    expect(validateEditRules(rules, 'a', rows[1]!, false, ctx).messages).toEqual([
      'Value must be unique',
    ])
    // Pattern violation fails pattern.
    expect(validateEditRules(rules, 'A1', rows[0]!, false, ctx).messages).toEqual(['格式'])
    // All pass (fresh value 'c': unique + pattern-compliant).
    expect(validateEditRules(rules, 'c', rows[0]!, false, ctx).valid).toBe(true)
  })

  it('skips the rule without a rows context (documented no-op)', () => {
    expect(validateEditRules([{ unique: true }], 'a', { name: 'a' }).valid).toBe(true)
    expect(
      validateEditRules([{ unique: true }], 'a', { name: 'a' }, false, {
        rows: [],
        columnKey: 'name',
      }).valid,
    ).toBe(true)
    expect(
      validateEditRules([{ unique: true }], 'a', { name: 'a' }, false, {
        rows: [{ name: 'a' }],
        columnKey: undefined as unknown as string,
      }).valid,
    ).toBe(true)
  })

  it('skips the editing row by reference identity', () => {
    const self: Row = { name: 'a' }
    const list: Row[] = [self, { name: 'b' }]
    const c = { rows: list, columnKey: 'name' }
    // Editing self to its own current value 'a' — only matched by reference → pass.
    expect(validateEditRules([{ unique: true }], 'a', self, false, c).valid).toBe(true)
    // 'b' collides with the OTHER row (not the editing row) → fail.
    expect(validateEditRules([{ unique: true }], 'b', self, false, c).valid).toBe(false)
  })

  it('compares by String across types', () => {
    interface NumRow {
      v: number | string
    }
    const list: NumRow[] = [{ v: 1 }, { v: '1' }]
    const c = { rows: list, columnKey: 'v' }
    expect(validateEditRules([{ unique: true }], '1', list[1]!, false, c).valid).toBe(false)
    expect(validateEditRules([{ unique: true }], 2, list[1]!, false, c).valid).toBe(true)
  })

  it('works through the async API with context', async () => {
    expect(
      await validateEditRulesAsync([{ unique: true }], 'a', rows[1]!, false, ctx),
    ).toMatchObject({ valid: false, messages: ['Value must be unique'] })
    expect(
      await validateEditRulesAsync([{ unique: true }], 'b', rows[1]!, false, ctx),
    ).toMatchObject({
      valid: true,
    })
  })
})
