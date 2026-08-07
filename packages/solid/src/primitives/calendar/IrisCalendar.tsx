import {
  createMemo,
  createSignal,
  createEffect,
  For,
  mergeProps,
  splitProps,
  type JSX,
} from 'solid-js'
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
  safeLocale,
  startOfDay,
  startOfMonth,
} from './dateUtils'
import { useI18n } from '../../i18n'

export interface IrisCalendarProps {
  value?: Date | null
  defaultValue?: Date | null
  defaultMonth?: Date | null
  min?: Date
  max?: Date
  weekStartsOn?: number
  locale?: string
  disabled?: boolean
  onChange?: (date: Date | null) => void
}

/**
 * Month-view calendar. Single date selection. Keyboard navigable.
 * Solid port of the Vue IrisCalendar.
 */
export function IrisCalendar(props: IrisCalendarProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultValue: null as Date | null,
      defaultMonth: null as Date | null,
      weekStartsOn: 0,
      disabled: false,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'value',
    'defaultValue',
    'defaultMonth',
    'min',
    'max',
    'weekStartsOn',
    'locale',
    'disabled',
    'onChange',
  ])

  const { t } = useI18n()

  const initialMonth = local.defaultMonth ?? local.defaultValue ?? local.value ?? new Date()
  const [visibleMonth, setVisibleMonth] = createSignal(startOfMonth(initialMonth))
  const [focusDate, setFocusDate] = createSignal<Date>(
    clampDate(local.value ?? local.defaultValue ?? new Date(), local.min, local.max),
  )

  // Selection: controlled via `value`, otherwise an internal signal seeded from
  // `defaultValue` (parity with the React adapter). Previously `aria-selected`
  // read only `local.value`, so a `defaultValue` / uncontrolled calendar never
  // reflected a selection — clicking a day fired `onChange` but nothing showed.
  const isControlled = (): boolean => local.value !== undefined
  const [internalSelected, setInternalSelected] = createSignal<Date | null>(
    local.defaultValue ?? null,
  )
  const selectedValue = (): Date | null =>
    isControlled() ? (local.value ?? null) : internalSelected()

  // Sync visible month when controlled value changes to a different month
  createEffect(() => {
    const v = local.value
    if (v && !isSameMonth(v, visibleMonth())) {
      setVisibleMonth(startOfMonth(v))
      setFocusDate(clampDate(v, local.min, local.max))
    }
  })

  const matrix = createMemo(() => buildMonthMatrix(visibleMonth(), local.weekStartsOn))
  const weekdays = createMemo(() => getWeekdayNames(local.weekStartsOn, local.locale))
  const title = createMemo(() => formatMonthYear(visibleMonth(), local.locale))
  // One memoized formatter for the full-date cell label (e.g. "Monday, June 9,
  // 2026") so screen readers announce the whole date, not just the day number.
  const dayLabelFmt = createMemo(
    () =>
      new Intl.DateTimeFormat(safeLocale(local.locale), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
  )
  const today = startOfDay(new Date())

  const prevDisabled = createMemo(() => {
    if (!local.min) return false
    return startOfMonth(visibleMonth()) <= startOfMonth(local.min)
  })
  const nextDisabled = createMemo(() => {
    if (!local.max) return false
    return startOfMonth(endOfMonth(visibleMonth())) >= startOfMonth(local.max)
  })

  const goPrevMonth = () => setVisibleMonth((m) => addMonths(m, -1))
  const goNextMonth = () => setVisibleMonth((m) => addMonths(m, 1))

  const moveFocus = (delta: number) => {
    const next = clampDate(addDays(focusDate(), delta), local.min, local.max)
    setFocusDate(next)
    if (!isSameMonth(next, visibleMonth())) {
      setVisibleMonth(startOfMonth(next))
    }
  }

  const selectDate = (date: Date) => {
    if (local.disabled) return
    if (isOutOfRange(date, local.min, local.max)) return
    const next = startOfDay(date)
    if (!isControlled()) setInternalSelected(next)
    local.onChange?.(next)
  }

  const onGridKeyDown = (event: KeyboardEvent) => {
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
        const offset = focusDate().getDay() - local.weekStartsOn
        moveFocus(-((offset + 7) % 7))
        break
      }
      case 'End': {
        event.preventDefault()
        const offset = (focusDate().getDay() - local.weekStartsOn + 7) % 7
        moveFocus(6 - offset)
        break
      }
      case 'PageUp':
        event.preventDefault()
        setVisibleMonth((m) => addMonths(m, -1))
        setFocusDate((d) => clampDate(addMonths(d, -1), local.min, local.max))
        break
      case 'PageDown':
        event.preventDefault()
        setVisibleMonth((m) => addMonths(m, 1))
        setFocusDate((d) => clampDate(addMonths(d, 1), local.min, local.max))
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        selectDate(focusDate())
        break
    }
  }

  const navBtnStyle: JSX.CSSProperties = {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    background: 'transparent',
    border: 'none',
    color: 'var(--iris-foreground)',
    cursor: 'pointer',
    'border-radius': 'var(--iris-radius-sm, 4px)',
    font: 'inherit',
  }

  return (
    <div
      data-iris-calendar=""
      data-disabled={local.disabled ? '' : undefined}
      style={{
        display: 'inline-flex',
        'flex-direction': 'column',
        gap: '8px',
        padding: 'var(--iris-padding-md, 12px)',
        background: 'var(--iris-surface)',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        'border-radius': 'var(--iris-radius-md, 6px)',
        'min-width': '260px',
      }}
    >
      {/* Header */}
      <div
        data-iris-calendar-header=""
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          gap: '4px',
        }}
      >
        <button
          type="button"
          aria-label={t('calendar.previousMonth')}
          data-iris-calendar-prev=""
          disabled={prevDisabled() || undefined}
          onClick={goPrevMonth}
          style={{
            ...navBtnStyle,
            opacity: prevDisabled() ? '0.4' : '1',
            cursor: prevDisabled() ? 'not-allowed' : 'pointer',
          }}
        >
          ‹
        </button>
        <div
          data-iris-calendar-title=""
          aria-live="polite"
          style={{ 'font-weight': '600', 'font-size': 'var(--iris-font-size-md, 14px)' }}
        >
          {title()}
        </div>
        <button
          type="button"
          aria-label={t('calendar.nextMonth')}
          data-iris-calendar-next=""
          disabled={nextDisabled() || undefined}
          onClick={goNextMonth}
          style={{
            ...navBtnStyle,
            opacity: nextDisabled() ? '0.4' : '1',
            cursor: nextDisabled() ? 'not-allowed' : 'pointer',
          }}
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div
        data-iris-calendar-weekdays=""
        role="row"
        style={{
          display: 'grid',
          'grid-template-columns': 'repeat(7, minmax(0, 1fr))',
          gap: 'var(--iris-space-xxs, 4px)',
          'font-size': 'var(--iris-font-size-xs, 12px)',
          color: 'var(--iris-muted)',
          'text-align': 'center',
        }}
      >
        <For each={weekdays()}>
          {(name) => (
            <div role="columnheader" style={{ padding: 'var(--iris-space-xxs, 4px) 0' }}>
              {name}
            </div>
          )}
        </For>
      </div>

      {/* Day grid */}
      <div
        data-iris-calendar-grid=""
        role="grid"
        aria-label={title()}
        onKeyDown={onGridKeyDown}
        style={{
          display: 'grid',
          'grid-template-columns': 'repeat(7, minmax(0, 1fr))',
          gap: 'var(--iris-space-xxs, 4px)',
        }}
      >
        <For each={matrix()}>
          {(row) => (
            // `display: contents` keeps the row in the accessibility tree (a
            // valid grid → row → gridcell structure) while letting its day cells
            // participate directly in the parent's 7-column CSS grid layout.
            <div role="row" style={{ display: 'contents' }}>
              <For each={row}>
                {(date) => {
                  const inMonth = () => isSameMonth(date, visibleMonth())
                  const selected = () => {
                    const sv = selectedValue()
                    return sv ? isSameDay(date, sv) : false
                  }
                  const focused = () => isSameDay(date, focusDate())
                  const isToday = () => isSameDay(date, today)
                  const oof = () => isOutOfRange(date, local.min, local.max)
                  const isDisabled = () => local.disabled || oof()

                  return (
                    <button
                      type="button"
                      role="gridcell"
                      aria-label={dayLabelFmt().format(date)}
                      tabIndex={focused() ? 0 : -1}
                      aria-selected={selected() ? 'true' : 'false'}
                      aria-disabled={isDisabled() ? 'true' : undefined}
                      aria-current={isToday() ? 'date' : undefined}
                      data-iris-calendar-day=""
                      data-iris-calendar-day-iso={formatLocalISO(date)}
                      data-state={
                        selected()
                          ? 'selected'
                          : focused()
                            ? 'focused'
                            : isToday()
                              ? 'today'
                              : 'idle'
                      }
                      data-outside-month={!inMonth() ? 'true' : undefined}
                      disabled={isDisabled() || undefined}
                      onClick={() => {
                        setFocusDate(date)
                        selectDate(date)
                      }}
                      onFocus={() => setFocusDate(date)}
                      style={{
                        height: '32px',
                        display: 'inline-flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        background: selected()
                          ? 'var(--iris-primary)'
                          : isToday()
                            ? 'var(--iris-surface-hover)'
                            : 'transparent',
                        color: selected()
                          ? 'var(--iris-primary-foreground, #fff)'
                          : inMonth()
                            ? 'var(--iris-foreground)'
                            : 'var(--iris-muted)',
                        border: 'none',
                        'border-radius': 'var(--iris-radius-sm, 4px)',
                        cursor: isDisabled() ? 'not-allowed' : 'pointer',
                        opacity: isDisabled() ? '0.45' : '1',
                        'font-size': 'var(--iris-font-size-sm, 13px)',
                        'font-family': 'inherit',
                        outline: 'none',
                      }}
                    >
                      {String(date.getDate())}
                    </button>
                  )
                }}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
