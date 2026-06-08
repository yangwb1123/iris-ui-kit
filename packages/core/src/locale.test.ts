import { describe, it, expect } from 'vitest'
import { localeDirection, isRtlLocale, localeWeekStartsOn } from './locale'

describe('localeDirection', () => {
  it('detects LTR locales', () => {
    expect(localeDirection('en-US')).toBe('ltr')
    expect(localeDirection('zh-CN')).toBe('ltr')
    expect(localeDirection('de')).toBe('ltr')
  })

  it('detects RTL locales (Arabic / Hebrew / Persian / Urdu)', () => {
    expect(localeDirection('ar-SA')).toBe('rtl')
    expect(localeDirection('he-IL')).toBe('rtl')
    expect(localeDirection('fa')).toBe('rtl')
    expect(localeDirection('ur-PK')).toBe('rtl')
  })

  it('isRtlLocale mirrors localeDirection', () => {
    expect(isRtlLocale('ar')).toBe(true)
    expect(isRtlLocale('en')).toBe(false)
  })

  it('never throws on garbage; falls back to ltr', () => {
    expect(localeDirection('')).toBe('ltr')
    expect(localeDirection('not-a-locale!!')).toBe('ltr')
  })
})

describe('localeWeekStartsOn', () => {
  it('returns a 0..6 index', () => {
    const v = localeWeekStartsOn('en-US')
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(6)
  })

  it('never throws on garbage; falls back to 0 (Sunday)', () => {
    expect(localeWeekStartsOn('not-a-locale!!')).toBe(0)
  })
})
