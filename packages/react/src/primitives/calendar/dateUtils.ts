// Date helpers now live in @iris-ui-kit/core (single source across all four
// frameworks). Re-exported so existing `./dateUtils` imports keep working.
export {
  startOfDay,
  isSameDay,
  isSameMonth,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  buildMonthMatrix,
  formatMonthYear,
  getWeekdayNames,
  formatLocalISO,
  clampDate,
  isOutOfRange,
} from '@iris-ui-kit/core'

/**
 * A locale tag safe to hand to `Intl.DateTimeFormat`. A malformed BCP-47 tag
 * (e.g. `'en_US'`, `'bad locale!'`) would otherwise throw a `RangeError` and
 * crash the calendar. `undefined` passes through so the runtime default locale
 * is used; a malformed tag also falls back to that default.
 */
export function safeLocale(locale: string | undefined): string | undefined {
  if (locale === undefined) return undefined
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? undefined
  } catch {
    return undefined
  }
}
