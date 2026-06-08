// Date helpers now live in @iris-ui/core (single source across all four
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
} from '@iris-ui/core'
