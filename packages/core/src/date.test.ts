import { describe, it, expect } from 'vitest'
import {
  startOfDay,
  isSameDay,
  isSameMonth,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  buildMonthMatrix,
  formatLocalISO,
  formatClock,
  clampDate,
  isOutOfRange,
  getWeekdayNames,
  formatMonthYear,
} from './date'

describe('date helpers', () => {
  it('startOfDay zeroes the time', () => {
    const d = startOfDay(new Date(2024, 2, 15, 13, 30))
    expect(d.getHours()).toBe(0)
    expect(d.getDate()).toBe(15)
  })

  it('isSameDay / isSameMonth', () => {
    expect(isSameDay(new Date(2024, 0, 1), new Date(2024, 0, 1, 23))).toBe(true)
    expect(isSameDay(new Date(2024, 0, 1), new Date(2024, 0, 2))).toBe(false)
    expect(isSameMonth(new Date(2024, 0, 1), new Date(2024, 0, 31))).toBe(true)
    expect(isSameMonth(new Date(2024, 0, 1), new Date(2024, 1, 1))).toBe(false)
  })

  it('addDays / addMonths (with end-of-month clamp)', () => {
    expect(addDays(new Date(2024, 0, 31), 1).getDate()).toBe(1)
    // Jan 31 + 1 month → Feb 29 (2024 leap year), clamped from 31.
    const feb = addMonths(new Date(2024, 0, 31), 1)
    expect(feb.getMonth()).toBe(1)
    expect(feb.getDate()).toBe(29)
  })

  it('startOfMonth / endOfMonth', () => {
    expect(startOfMonth(new Date(2024, 1, 15)).getDate()).toBe(1)
    expect(endOfMonth(new Date(2024, 1, 15)).getDate()).toBe(29)
  })

  it('buildMonthMatrix is always 6×7 and covers the month', () => {
    const matrix = buildMonthMatrix(new Date(2024, 1, 1), 0)
    expect(matrix).toHaveLength(6)
    expect(matrix.every((r) => r.length === 7)).toBe(true)
    const flat = matrix.flat()
    expect(flat.some((d) => isSameDay(d, new Date(2024, 1, 1)))).toBe(true)
    expect(flat.some((d) => isSameDay(d, new Date(2024, 1, 29)))).toBe(true)
  })

  it('formatLocalISO is local-time YYYY-MM-DD', () => {
    expect(formatLocalISO(new Date(2024, 0, 5))).toBe('2024-01-05')
  })

  it('formatClock is 24h HH:MM:SS with midnight zero-padded', () => {
    expect(formatClock(new Date(2026, 0, 1, 0, 0, 0))).toBe('00:00:00')
    expect(formatClock(new Date(2026, 0, 1, 23, 59, 59))).toBe('23:59:59')
  })

  it('formatClock pads single-digit hours/minutes/seconds', () => {
    expect(formatClock(new Date(2026, 0, 1, 9, 5, 30))).toBe('09:05:30')
    expect(formatClock(new Date(2026, 0, 1, 13, 7, 3))).toBe('13:07:03')
  })

  it('clampDate / isOutOfRange', () => {
    const min = new Date(2024, 0, 10)
    const max = new Date(2024, 0, 20)
    expect(clampDate(new Date(2024, 0, 5), min, max)).toBe(min)
    expect(clampDate(new Date(2024, 0, 25), min, max)).toBe(max)
    expect(isOutOfRange(new Date(2024, 0, 5), min, max)).toBe(true)
    expect(isOutOfRange(new Date(2024, 0, 15), min, max)).toBe(false)
  })

  it('getWeekdayNames returns 7 names honoring weekStartsOn', () => {
    const sun = getWeekdayNames(0, 'en-US')
    const mon = getWeekdayNames(1, 'en-US')
    expect(sun).toHaveLength(7)
    expect(mon[0]).toBe(sun[1]) // Monday-first shifts the start
  })

  describe('malformed-locale robustness', () => {
    const date = new Date(2026, 4, 29)

    it('formatMonthYear falls back instead of throwing on a malformed locale', () => {
      expect(() => formatMonthYear(date, 'bad locale!')).not.toThrow()
      expect(() => formatMonthYear(date, 'en_US')).not.toThrow()
      expect(formatMonthYear(date, 'bad locale!')).toBeTruthy()
    })

    it('getWeekdayNames falls back instead of throwing on a malformed locale', () => {
      expect(() => getWeekdayNames(0, '@@@')).not.toThrow()
      expect(getWeekdayNames(0, 'not a locale')).toHaveLength(7)
    })

    it('still honors a valid locale and the no-locale (host default) path', () => {
      expect(formatMonthYear(date, 'en-US')).toContain('May')
      expect(() => formatMonthYear(date)).not.toThrow()
      expect(getWeekdayNames(0, 'zz')).toHaveLength(7) // unknown but well-formed
    })
  })
})
