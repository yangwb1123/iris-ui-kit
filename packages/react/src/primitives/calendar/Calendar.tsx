import * as React from 'react'
import { createCalendarNav } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { useStore } from '../../useStore'
import {
  buildMonthMatrix,
  clampDate,
  endOfMonth,
  formatLocalISO,
  formatMonthYear,
  getWeekdayNames,
  isOutOfRange,
  isSameDay,
  isSameMonth,
  safeLocale,
  startOfDay,
  startOfMonth,
} from './dateUtils'

export interface IrisCalendarProps {
  value?: Date | null
  defaultValue?: Date | null
  onValueChange?: (next: Date | null) => void
  /** Initial visible month (defaults to selected value or today). */
  defaultMonth?: Date
  min?: Date
  max?: Date
  /** 0–6, 0 = Sunday. Default 0. */
  weekStartsOn?: number
  locale?: string
  disabled?: boolean
  style?: React.CSSProperties
  className?: string
}

/**
 * Month-view calendar. Single-date selection only. Keyboard:
 *   - Arrow keys move focus
 *   - Home / End jump to start/end of week
 *   - PageUp / PageDown move by month
 *   - Enter / Space select
 */
export function IrisCalendar({
  value: valueProp,
  defaultValue,
  onValueChange,
  defaultMonth,
  min,
  max,
  weekStartsOn = 0,
  locale,
  disabled = false,
  style,
  className,
  ...rest
}: IrisCalendarProps): React.ReactElement {
  const { t } = useI18n()
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<Date | null>(defaultValue ?? null)
  const selectedValue = isControlled ? (valueProp as Date | null) : internal

  const initialMonth = defaultMonth ?? selectedValue ?? new Date()
  // Keyboard roving lives in the core `createCalendarNav` controller; this
  // adapter only renders and bridges. Options are captured at creation (the
  // resource-controller precedent): min/max/weekStartsOn changes require a
  // remount — documented limitation.
  const nav = React.useMemo(
    () =>
      createCalendarNav({
        initialMonth: startOfMonth(initialMonth),
        initialFocusDate: clampDate(selectedValue ?? new Date(), min, max),
        weekStartsOn,
        min,
        max,
      }),
    [],
  )
  const { visibleMonth, focusDate } = useStore(nav.store)

  // Sync visible month if value moves to a different month.
  React.useEffect(() => {
    if (selectedValue && !isSameMonth(selectedValue, nav.getVisibleMonth())) {
      nav.setVisibleMonth(startOfMonth(selectedValue))
      nav.setFocusDate(clampDate(selectedValue, min, max))
    }
  }, [selectedValue, nav, min, max])

  const matrix = React.useMemo(
    () => buildMonthMatrix(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn],
  )
  const weekdays = React.useMemo(
    () => getWeekdayNames(weekStartsOn, locale),
    [weekStartsOn, locale],
  )
  const title = React.useMemo(() => formatMonthYear(visibleMonth, locale), [visibleMonth, locale])
  // One memoized formatter for the full-date cell label (e.g. "Monday, June 9,
  // 2026") so screen readers announce the whole date, not just the day number.
  const dayLabelFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(safeLocale(locale), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [locale],
  )

  const setValue = (next: Date | null) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  const selectDate = (date: Date) => {
    if (disabled) return
    if (isOutOfRange(date, min, max)) return
    setValue(startOfDay(date))
  }

  const onGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (nav.handleKey(event.key)) {
      event.preventDefault()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectDate(focusDate)
    }
  }

  const today = startOfDay(new Date())
  const prevDisabled = min ? startOfMonth(visibleMonth) <= startOfMonth(min) : false
  const nextDisabled = max ? startOfMonth(endOfMonth(visibleMonth)) >= startOfMonth(max) : false

  const navButtonStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: 'var(--iris-foreground)',
    cursor: 'pointer',
    borderRadius: 'var(--iris-radius-sm, 4px)',
    font: 'inherit',
  }

  return (
    <div
      className={className}
      data-iris-calendar=""
      data-disabled={disabled ? '' : undefined}
      {...rest}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 8,
        padding: 'var(--iris-padding-md, 12px)',
        background: 'var(--iris-surface)',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        minWidth: 260,
        ...style,
      }}
    >
      <div
        data-iris-calendar-header=""
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
        }}
      >
        <button
          type="button"
          aria-label={t('calendar.previousMonth')}
          data-iris-calendar-prev=""
          disabled={prevDisabled || undefined}
          onClick={() => nav.goToMonth(-1)}
          style={{
            ...navButtonStyle,
            opacity: prevDisabled ? 0.4 : 1,
            cursor: prevDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          ‹
        </button>
        <div
          data-iris-calendar-title=""
          aria-live="polite"
          style={{ fontWeight: 600, fontSize: 'var(--iris-font-size-md, 14px)' }}
        >
          {title}
        </div>
        <button
          type="button"
          aria-label={t('calendar.nextMonth')}
          data-iris-calendar-next=""
          disabled={nextDisabled || undefined}
          onClick={() => nav.goToMonth(1)}
          style={{
            ...navButtonStyle,
            opacity: nextDisabled ? 0.4 : 1,
            cursor: nextDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          ›
        </button>
      </div>
      <div
        data-iris-calendar-weekdays=""
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 'var(--iris-space-xxs, 4px)',
          fontSize: 'var(--iris-font-size-xs, 12px)',
          color: 'var(--iris-muted)',
          textAlign: 'center',
        }}
      >
        {weekdays.map((name) => (
          <div key={name} role="columnheader" style={{ padding: 'var(--iris-space-xxs, 4px) 0' }}>
            {name}
          </div>
        ))}
      </div>
      <div
        data-iris-calendar-grid=""
        role="grid"
        aria-label={title}
        onKeyDown={onGridKeyDown}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 'var(--iris-space-xxs, 4px)',
        }}
      >
        {matrix.map((week, wi) => (
          <div
            key={`week-${wi}`}
            role="row"
            // `display: contents` keeps the row in the accessibility tree (a
            // valid grid → row → gridcell structure) while letting its day cells
            // participate directly in the parent's 7-column CSS grid layout.
            style={{ display: 'contents' }}
          >
            {week.map((date) => {
              const inMonth = isSameMonth(date, visibleMonth)
              const selected = selectedValue ? isSameDay(date, selectedValue) : false
              const focused = isSameDay(date, focusDate)
              const isToday = isSameDay(date, today)
              const oof = isOutOfRange(date, min, max)
              const isDisabled = disabled || oof
              return (
                <button
                  key={formatLocalISO(date)}
                  type="button"
                  role="gridcell"
                  aria-label={dayLabelFmt.format(date)}
                  tabIndex={focused ? 0 : -1}
                  aria-selected={selected}
                  aria-disabled={isDisabled ? 'true' : undefined}
                  aria-current={isToday ? 'date' : undefined}
                  data-iris-calendar-day=""
                  data-iris-calendar-day-iso={formatLocalISO(date)}
                  data-state={
                    selected ? 'selected' : focused ? 'focused' : isToday ? 'today' : 'idle'
                  }
                  data-outside-month={!inMonth ? 'true' : undefined}
                  disabled={isDisabled || undefined}
                  onClick={() => {
                    nav.setFocusDate(date)
                    selectDate(date)
                  }}
                  onFocus={() => nav.setFocusDate(date)}
                  style={{
                    height: 32,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: selected
                      ? 'var(--iris-primary)'
                      : isToday
                        ? 'var(--iris-surface-hover)'
                        : 'transparent',
                    color: selected
                      ? 'var(--iris-primary-foreground, #fff)'
                      : inMonth
                        ? 'var(--iris-foreground)'
                        : 'var(--iris-muted)',
                    border: 'none',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.45 : 1,
                    fontSize: 'var(--iris-font-size-sm, 13px)',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
