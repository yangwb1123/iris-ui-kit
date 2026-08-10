import {
  createMemo,
  createSignal,
  createEffect,
  For,
  mergeProps,
  splitProps,
  type JSX,
} from 'solid-js'
import { createCalendarNav } from '@iris-ui-kit/core'
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
import { useStore } from '../../useStore'
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
  // Keyboard roving lives in the core `createCalendarNav` controller; this
  // adapter only renders and bridges. Options are captured at creation.
  const nav = createCalendarNav({
    initialMonth: startOfMonth(initialMonth),
    initialFocusDate: clampDate(
      local.value ?? local.defaultValue ?? new Date(),
      local.min,
      local.max,
    ),
    weekStartsOn: local.weekStartsOn,
    min: local.min,
    max: local.max,
  })
  const state = useStore(nav.store)
  // Slice memos: the matrix must NOT rebuild on focus-only changes (a rebuilt
  // matrix array makes `<For>` recreate every cell button, dropping focus).
  // `state()` returns a fresh object per store emit, so read the Date refs
  // through memos that bail out when the reference is unchanged.
  const visibleMonth = createMemo(() => state().visibleMonth)
  const focusDate = createMemo(() => state().focusDate)

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
    if (v && !isSameMonth(v, nav.getVisibleMonth())) {
      nav.setVisibleMonth(startOfMonth(v))
      nav.setFocusDate(clampDate(v, local.min, local.max))
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

  const goPrevMonth = () => nav.goToMonth(-1)
  const goNextMonth = () => nav.goToMonth(1)

  const selectDate = (date: Date) => {
    if (local.disabled) return
    if (isOutOfRange(date, local.min, local.max)) return
    const next = startOfDay(date)
    if (!isControlled()) setInternalSelected(next)
    local.onChange?.(next)
  }

  const onGridKeyDown = (event: KeyboardEvent) => {
    if (nav.handleKey(event.key)) {
      event.preventDefault()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectDate(focusDate())
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
                        nav.setFocusDate(date)
                        selectDate(date)
                      }}
                      onFocus={() => nav.setFocusDate(date)}
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
