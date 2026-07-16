/**
 * Framework-agnostic date helpers (C-layer **material**) used by IrisCalendar /
 * DatePicker / DateRangePicker — each framework carried a copy. Pure, no
 * timezone surprises (local-time throughout). The month-matrix builder always
 * returns a 6×7 grid so calendars don't reflow between months.
 */

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  // Clamp to last day of the new month.
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return d
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/**
 * Build a 6-row × 7-col matrix of dates covering `date`'s month. Includes
 * leading days from the previous month and trailing days from the next, so the
 * grid is always 42 cells. `weekStartsOn` 0–6 (0=Sunday).
 */
export function buildMonthMatrix(date: Date, weekStartsOn: number): Date[][] {
  const first = startOfMonth(date)
  const firstWeekday = first.getDay()
  const offset = (firstWeekday - weekStartsOn + 7) % 7
  const start = addDays(first, -offset)
  const rows: Date[][] = []
  for (let r = 0; r < 6; r += 1) {
    const row: Date[] = []
    for (let c = 0; c < 7; c += 1) {
      row.push(addDays(start, r * 7 + c))
    }
    rows.push(row)
  }
  return rows
}

/**
 * A locale tag safe to hand to `Intl.DateTimeFormat`. A malformed BCP-47 tag
 * (e.g. `'en_US'`, `'bad locale!'`) would otherwise throw a `RangeError` and
 * crash the calendar. `undefined` is passed through unchanged so the runtime
 * default locale is used; a malformed tag also falls back to that default
 * rather than to a hard-coded language.
 */
function safeLocale(locale: string | undefined): string | undefined {
  if (locale === undefined) return undefined
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? undefined
  } catch {
    return undefined
  }
}

export function formatMonthYear(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(safeLocale(locale), { month: 'long', year: 'numeric' }).format(
    date,
  )
}

export function getWeekdayNames(weekStartsOn: number, locale?: string): string[] {
  // Reference week from a known Sunday (1970-01-04 was a Sunday).
  const sunday = new Date(1970, 0, 4)
  const fmt = new Intl.DateTimeFormat(safeLocale(locale), { weekday: 'short' })
  const names: string[] = []
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(sunday, (weekStartsOn + i) % 7)
    names.push(fmt.format(day))
  }
  return names
}

/**
 * Local-time `YYYY-MM-DD`. Unlike `toISOString()` (UTC, can shift the day for
 * timezones east/west of UTC), this is the day as the user sees it locally.
 */
export function formatLocalISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function clampDate(date: Date, min?: Date, max?: Date): Date {
  let d = date
  if (min && d < min) d = min
  if (max && d > max) d = max
  return d
}

export function isOutOfRange(date: Date, min?: Date, max?: Date): boolean {
  if (min && startOfDay(date) < startOfDay(min)) return true
  if (max && startOfDay(date) > startOfDay(max)) return true
  return false
}
