import { describe, expect, it } from 'vitest'
import { summarizeColumn } from './summary'

describe('@iris-ui-kit/core summarizeColumn (batch AW, iris 独有)', () => {
  it('numeric branch: count / range / average / missing, one toFixed(1) rounding point', () => {
    const s = summarizeColumn([1, 2, 3, 4, 10, 1.25, null, ''], 'Score')
    expect(s).toBe('Score：共 6 个值，范围 1.0–10.0，平均 3.5，2 个缺失')
  })

  it('numeric branch threshold is ≥60% INCLUSIVE (exactly 3 of 5 numeric → numeric)', () => {
    const s = summarizeColumn([1, 2, 3, 'x', 'y'], 'Mix')
    expect(s).toBe('Mix：共 5 个值，范围 1.0–3.0，平均 2.0，0 个缺失')
  })

  it('below 60% falls to the categorical branch', () => {
    const s = summarizeColumn([1, 2, 'a', 'b', 'c', 'd'], 'Mix')
    expect(s.startsWith('Mix：')).toBe(true)
    // 2 of 6 = 33% numeric → categorical top3 of the strings.
    expect(s).toContain('% ')
    expect(s).toContain('其余 3 个')
  })

  it('categorical branch: top3 with integer Math.round percentages + 其余 R 个', () => {
    const values = ['active', 'active', 'active', 'paused', 'offline', 'archived', 'banned']
    // 7 values: active 3/7 = 42.86 → 43%; singles 1/7 = 14.29 → 14% each; 5 distinct → 其余 2 个.
    const s = summarizeColumn(values, 'Status')
    expect(s).toBe('Status：43% active，14% paused，14% offline，其余 2 个')
  })

  it('categorical with ≤3 distinct values has NO 其余 fold', () => {
    const s = summarizeColumn(['a', 'b', 'a', 'c', 'a'], 'Letter')
    expect(s).toBe('Letter：60% a，20% b，20% c')
  })

  it('categorical single distinct value → 100% without a fold', () => {
    const s = summarizeColumn(['x', 'x', 'x'], 'Kind')
    expect(s).toBe('Kind：100% x')
  })

  it('numeric single value', () => {
    const s = summarizeColumn([5], 'N')
    expect(s).toBe('N：共 1 个值，范围 5.0–5.0，平均 5.0，0 个缺失')
  })

  it('empty value list → 无数据', () => {
    expect(summarizeColumn([], 'Col')).toBe('Col：无数据')
  })

  it('all values null / undefined / empty string → 无数据', () => {
    expect(summarizeColumn([null, undefined, ''], 'Col')).toBe('Col：无数据')
  })

  it('missing count counts null / undefined / empty strings', () => {
    const s = summarizeColumn([1, 2, null, undefined, ''], 'N')
    expect(s).toBe('N：共 2 个值，范围 1.0–2.0，平均 1.5，3 个缺失')
  })

  it('rounding: Math.round for categorical percentages, toFixed(1) for numeric', () => {
    // 1/3 → 33.33 → 33%; 2/3 → 66.67 → 67% (two entries, no fold).
    const cat = summarizeColumn(['a', 'b', 'b'], 'K')
    expect(cat).toBe('K：67% b，33% a')
    // 1/3 avg → 0.3333 → "0.3".
    const num = summarizeColumn([0, 1], 'N')
    expect(num).toBe('N：共 2 个值，范围 0.0–1.0，平均 0.5，0 个缺失')
    const third = summarizeColumn([0, 0, 1], 'N')
    expect(third).toContain('平均 0.3')
  })

  it('booleans are NOT numeric (Number(true) = 1 would poison the range)', () => {
    const s = summarizeColumn([true, false, 'x', 'y', 'z', 'w'], 'Flag')
    // 0 numeric → categorical; booleans coerce to "true"/"false" buckets.
    expect(s.startsWith('Flag：')).toBe(true)
    expect(s).toContain('% true')
  })

  it('numeric strings count as numeric; non-numeric strings are excluded from the range', () => {
    const s = summarizeColumn(['1', '2', '3', 'N/A'], 'N')
    expect(s).toBe('N：共 4 个值，范围 1.0–3.0，平均 2.0，0 个缺失')
  })
})
