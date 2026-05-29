import * as React from 'react'
import {
  addDays,
  addMonths,
  buildMonthMatrix,
  clampDate,
  endOfMonth,
  formatLocalISO,
  formatMonthYear,
  getWeekdayNames,
  isOutOfRange,
  isSameDay,
  isSameMonth,
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
}: IrisCalendarProps): React.ReactElement {
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<Date | null>(defaultValue ?? null)
  const selectedValue = isControlled ? (valueProp as Date | null) : internal

  const initialMonth = defaultMonth ?? selectedValue ?? new Date()
  const [visibleMonth, setVisibleMonth] = React.useState<Date>(startOfMonth(initialMonth))
  const [focusDate, setFocusDate] = React.useState<Date>(
    clampDate(selectedValue ?? new Date(), min, max),
  )

  // Sync visible month if value moves to a different month.
  React.useEffect(() => {
    if (selectedValue && !isSameMonth(selectedValue, visibleMonth)) {
      setVisibleMonth(startOfMonth(selectedValue))
      setFocusDate(clampDate(selectedValue, min, max))
    }
  }, [selectedValue, visibleMonth, min, max])

  const matrix = React.useMemo(
    () => buildMonthMatrix(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn],
  )
  const weekdays = React.useMemo(
    () => getWeekdayNames(weekStartsOn, locale),
    [weekStartsOn, locale],
  )
  const title = React.useMemo(() => formatMonthYear(visibleMonth, locale), [visibleMonth, locale])

  const setValue = (next: Date | null) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  const moveFocus = (delta: number) => {
    const next = clampDate(addDays(focusDate, delta), min, max)
    setFocusDate(next)
    if (!isSameMonth(next, visibleMonth)) {
      setVisibleMonth(startOfMonth(next))
    }
  }

  const selectDate = (date: Date) => {
    if (disabled) return
    if (isOutOfRange(date, min, max)) return
    setValue(startOfDay(date))
  }

  const onGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        moveFocus(-1)
        break
      case 'ArrowRight':
        event.preventDefault()
        moveFocus(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(-7)
        break
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(7)
        break
      case 'Home': {
        event.preventDefault()
        const offset = (focusDate.getDay() - weekStartsOn + 7) % 7
        moveFocus(-offset)
        break
      }
      case 'End': {
        event.preventDefault()
        const offset = (focusDate.getDay() - weekStartsOn + 7) % 7
        moveFocus(6 - offset)
        break
      }
      case 'PageUp':
        event.preventDefault()
        setVisibleMonth((m) => addMonths(m, -1))
        setFocusDate((d) => clampDate(addMonths(d, -1), min, max))
        break
      case 'PageDown':
        event.preventDefault()
        setVisibleMonth((m) => addMonths(m, 1))
        setFocusDate((d) => clampDate(addMonths(d, 1), min, max))
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        selectDate(focusDate)
        break
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
          aria-label="Previous month"
          data-iris-calendar-prev=""
          disabled={prevDisabled || undefined}
          onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
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
          style={{ fontWeight: 600, fontSize: 14 }}
        >
          {title}
        </div>
        <button
          type="button"
          aria-label="Next month"
          data-iris-calendar-next=""
          disabled={nextDisabled || undefined}
          onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
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
          gap: 2,
          fontSize: 12,
          color: 'var(--iris-muted)',
          textAlign: 'center',
        }}
      >
        {weekdays.map((name) => (
          <div key={name} role="columnheader" style={{ padding: '2px 0' }}>
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
          gap: 2,
        }}
      >
        {matrix.flat().map((date) => {
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
              tabIndex={focused ? 0 : -1}
              aria-selected={selected}
              aria-disabled={isDisabled ? 'true' : undefined}
              aria-current={isToday ? 'date' : undefined}
              data-iris-calendar-day=""
              data-iris-calendar-day-iso={formatLocalISO(date)}
              data-state={selected ? 'selected' : focused ? 'focused' : isToday ? 'today' : 'idle'}
              data-outside-month={!inMonth ? 'true' : undefined}
              disabled={isDisabled || undefined}
              onClick={() => {
                setFocusDate(date)
                selectDate(date)
              }}
              onFocus={() => setFocusDate(date)}
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
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
