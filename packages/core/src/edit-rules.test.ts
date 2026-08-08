import { describe, it, expect } from 'vitest'
import { validateEditRules, validateEditRulesAsync, type EditRule } from './edit-rules'

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
