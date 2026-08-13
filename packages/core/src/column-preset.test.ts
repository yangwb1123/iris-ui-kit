import { describe, expect, it } from 'vitest'
import {
  applyColumnPreset,
  COLUMN_PRESET_DEFAULTS,
  formatDateValue,
  formatMoney,
  formatProgress,
  formatStatus,
  type ColumnPresetDescriptor,
} from './column-preset'

describe('@iris-ui-kit/core column-preset pure formatters (batch AN, iris 独有)', () => {
  it('formatMoney: 2 fixed decimals + thousands separators', () => {
    expect(formatMoney(1234.5)).toBe('1,234.50')
    expect(formatMoney(0)).toBe('0.00')
    expect(formatMoney(1234567.891)).toBe('1,234,567.89')
    expect(formatMoney(-1234.56)).toBe('-1,234.56')
    expect(formatMoney(9)).toBe('9.00')
  })

  it('formatMoney: nullish → "", non-numeric passthrough', () => {
    expect(formatMoney(null)).toBe('')
    expect(formatMoney(undefined)).toBe('')
    expect(formatMoney('abc')).toBe('abc')
    expect(formatMoney(Infinity)).toBe('Infinity')
  })

  it('formatProgress: 0..1 → rounded percent, else raw value with %', () => {
    expect(formatProgress(0.42)).toBe('42%')
    expect(formatProgress(0)).toBe('0%')
    expect(formatProgress(1)).toBe('100%')
    expect(formatProgress(0.005)).toBe('1%') // Math.round(0.5)
    expect(formatProgress('0.5')).toBe('50%') // numeric strings count as ratios
    expect(formatProgress(2)).toBe('2%')
    expect(formatProgress('abc')).toBe('abc%')
    expect(formatProgress(null)).toBe('')
  })

  it('formatDateValue: String passthrough, nullish → ""', () => {
    expect(formatDateValue('2026-08-13')).toBe('2026-08-13')
    expect(formatDateValue(20260813)).toBe('20260813')
    expect(formatDateValue(new Date(2026, 7, 13))).toBe(String(new Date(2026, 7, 13)))
    expect(formatDateValue(null)).toBe('')
    expect(formatDateValue(undefined)).toBe('')
  })

  it('formatStatus: plain-text UPPERCASE', () => {
    expect(formatStatus('active')).toBe('ACTIVE')
    expect(formatStatus('in review')).toBe('IN REVIEW')
    expect(formatStatus(1)).toBe('1')
    expect(formatStatus(null)).toBe('')
  })
})

describe('@iris-ui-kit/core applyColumnPreset (batch AN, iris 独有)', () => {
  const base = (): ColumnPresetDescriptor => ({ key: 'x', title: 'X' }) as ColumnPresetDescriptor

  it('money preset: formatter + right align + number editor + numeric editRules', () => {
    const col = applyColumnPreset(base(), 'money')
    expect(col.formatter).toBe(formatMoney)
    expect(col.align).toBe('right')
    expect(col.editor).toBe('number')
    expect(Array.isArray(col.editRules)).toBe(true)
    // The rules validate the raw input STRING (a { type: 'number' } rule would
    // reject every commit — drafts reach validation as strings).
    const rule = col.editRules![0] as { type: string; pattern: RegExp }
    expect(rule.type).toBe('pattern')
    expect(rule.pattern.test('99.5')).toBe(true)
    expect(rule.pattern.test('-12.34')).toBe(true)
    expect(rule.pattern.test('abc')).toBe(false)
    expect(col.formatter?.(1234.5)).toBe('1,234.50')
  })

  it('progress preset: percent formatter + right align, no editor/editRules', () => {
    const col = applyColumnPreset(base(), 'progress')
    expect(col.formatter).toBe(formatProgress)
    expect(col.align).toBe('right')
    expect(col.editor).toBeUndefined()
    expect(col.editRules).toBeUndefined()
  })

  it('date preset: String formatter + left align', () => {
    const col = applyColumnPreset(base(), 'date')
    expect(col.formatter).toBe(formatDateValue)
    expect(col.align).toBe('left')
  })

  it('status preset: UPPERCASE formatter + center align', () => {
    const col = applyColumnPreset(base(), 'status')
    expect(col.formatter).toBe(formatStatus)
    expect(col.align).toBe('center')
  })

  it('spread precedence: user fields always win over preset defaults', () => {
    const userFormatter = (v: unknown): string => `custom:${String(v)}`
    const userRules = [{ required: true }]
    const col = applyColumnPreset(
      {
        key: 'p',
        title: 'Price',
        formatter: userFormatter,
        align: 'left',
        editor: 'text',
        editRules: userRules,
      },
      'money',
    )
    expect(col.formatter).toBe(userFormatter)
    expect(col.align).toBe('left')
    expect(col.editor).toBe('text')
    expect(col.editRules).toBe(userRules)
  })

  it('defined-fields-only: align: undefined does NOT kill the preset default', () => {
    const col = applyColumnPreset({ key: 'p', title: 'Price', align: undefined }, 'money')
    expect(col.align).toBe('right')
    expect(col.formatter).toBe(formatMoney)
  })

  it('returns a NEW object and leaves the input untouched', () => {
    const input = { key: 'p', title: 'Price' }
    const out = applyColumnPreset(input, 'money')
    expect(out).not.toBe(input)
    expect(out.key).toBe('p')
    expect(input).not.toHaveProperty('align')
    expect(input).not.toHaveProperty('formatter')
    expect(out).toHaveProperty('align', 'right')
  })

  it('COLUMN_PRESET_DEFAULTS covers every preset value', () => {
    expect(Object.keys(COLUMN_PRESET_DEFAULTS).sort()).toEqual([
      'date',
      'money',
      'progress',
      'status',
    ])
  })
})
