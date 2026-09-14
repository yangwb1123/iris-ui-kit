import * as React from 'react'
import type { Placement } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverContent } from '../popover/PopoverContent'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import {
  formatLocalYearMonth,
  isOutOfMonthRange,
  safeLocale,
  startOfMonth,
} from '../calendar/dateUtils'

interface MonthOption {
  date: Date
  index: number
  label: string
  value: string
}

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime())
}

function monthAt(year: number, index: number): Date {
  return new Date(year, index, 1)
}

function formatMonthLabel(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(safeLocale(locale), { month: 'short' }).format(date)
}

function formatDisplay(date: Date | null, locale?: string): string {
  if (!isValidDate(date)) return ''
  return new Intl.DateTimeFormat(safeLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(startOfMonth(date))
}

function yearHasSelectableMonth(year: number, min?: Date, max?: Date): boolean {
  for (let index = 0; index < 12; index += 1) {
    if (!isOutOfMonthRange(monthAt(year, index), min, max)) return true
  }
  return false
}

function nextEnabledIndex(
  current: number,
  delta: number,
  year: number,
  min?: Date,
  max?: Date,
): number {
  let next = current + delta
  while (next >= 0 && next <= 11) {
    if (!isOutOfMonthRange(monthAt(year, next), min, max)) return next
    next += delta
  }
  return current
}

const triggerBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
  background: 'var(--iris-background)',
  borderRadius: 'var(--iris-radius-md, 6px)',
  fontSize: 'var(--iris-font-size-md, 14px)',
  fontFamily: 'inherit',
  minHeight: 'var(--iris-control-height-md, 34px)',
  minWidth: 180,
  textAlign: 'start',
}

const yearButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  padding: 0,
  background: 'transparent',
  color: 'var(--iris-foreground)',
  border: '1px solid transparent',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  font: 'inherit',
}

const monthButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: 'var(--iris-control-height-sm, 28px)',
  padding: 'var(--iris-space-xs, 8px)',
  background: 'transparent',
  color: 'var(--iris-foreground)',
  border: '1px solid var(--iris-border)',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  font: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/**
 * Month-only picker composed from Iris Popover primitives.
 *
 * The public value is a local-time `Date` normalized to the first day of its
 * month. The panel intentionally offers a 12-month grid rather than a native
 * month input, select, or day-level calendar.
 *
 * @example
 * <IrisMonthPicker value={month} onValueChange={setMonth} locale="en-US" />
 */
export interface IrisMonthPickerProps {
  value?: Date | null
  defaultValue?: Date | null
  onValueChange?: (next: Date | null) => void
  /** Initial visible year when no value is selected. */
  defaultMonth?: Date | null
  /** Inclusive month bounds; individual days are ignored. */
  min?: Date
  max?: Date
  locale?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  placement?: Placement
  /** id forwarded to the trigger. */
  id?: string
  /** Forwarded as aria-describedby on the trigger. */
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
}

export function IrisMonthPicker({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  defaultMonth,
  min,
  max,
  locale,
  placeholder,
  disabled = false,
  invalid = false,
  placement = 'bottom-start',
  id,
  ariaDescribedby,
  style,
  className,
  ...rest
}: IrisMonthPickerProps): React.ReactElement {
  const { t } = useI18n()
  const isControlled = valueProp !== undefined
  const [internalValue, setInternalValue] = React.useState<Date | null>(
    isValidDate(defaultValue) ? startOfMonth(defaultValue) : null,
  )
  const value = isControlled ? (valueProp ?? null) : internalValue
  const [open, setOpen] = React.useState(false)
  const initialMonth = isValidDate(value)
    ? value
    : isValidDate(defaultMonth)
      ? defaultMonth
      : new Date()
  const [visibleYear, setVisibleYear] = React.useState(initialMonth.getFullYear())
  const [focusedIndex, setFocusedIndex] = React.useState(isValidDate(value) ? value.getMonth() : 0)
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!isValidDate(value)) return
    setVisibleYear(value.getFullYear())
    setFocusedIndex(value.getMonth())
  }, [value])

  const selectedValue = isValidDate(value) ? formatLocalYearMonth(startOfMonth(value)) : undefined
  const display = formatDisplay(value, locale)
  const months = React.useMemo<MonthOption[]>(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const date = monthAt(visibleYear, index)
        return {
          date,
          index,
          label: formatMonthLabel(date, locale),
          value: formatLocalYearMonth(date),
        }
      }),
    [visibleYear, locale],
  )
  const previousYearDisabled = !yearHasSelectableMonth(visibleYear - 1, min, max)
  const nextYearDisabled = !yearHasSelectableMonth(visibleYear + 1, min, max)

  const focusMonth = (index: number): void => {
    setFocusedIndex(index)
    const value = months[index]?.value
    if (!value) return
    window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLButtonElement>(`[data-iris-month-picker-month="${value}"]`)
        ?.focus()
    })
  }

  const selectMonth = (index: number): void => {
    if (disabled) return
    const date = monthAt(visibleYear, index)
    if (isOutOfMonthRange(date, min, max)) return
    const next = startOfMonth(date)
    if (!isControlled) setInternalValue(next)
    onValueChange?.(next)
    setOpen(false)
  }

  const moveYear = (offset: number): void => {
    if (disabled) return
    const nextYear = visibleYear + offset
    if (!yearHasSelectableMonth(nextYear, min, max)) return
    setVisibleYear(nextYear)
    const currentMonth = monthAt(nextYear, focusedIndex)
    if (isOutOfMonthRange(currentMonth, min, max)) {
      const first = Array.from({ length: 12 }, (_, index) => index).find(
        (index) => !isOutOfMonthRange(monthAt(nextYear, index), min, max),
      )
      if (first !== undefined) setFocusedIndex(first)
    }
  }

  const handleMonthKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    let delta = 0
    if (event.key === 'ArrowLeft') delta = -1
    if (event.key === 'ArrowRight') delta = 1
    if (event.key === 'ArrowUp') delta = -3
    if (event.key === 'ArrowDown') delta = 3
    if (event.key === 'Home') {
      event.preventDefault()
      const first = months.find((month) => !isOutOfMonthRange(month.date, min, max))
      if (first) focusMonth(first.index)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      const last = [...months].reverse().find((month) => !isOutOfMonthRange(month.date, min, max))
      if (last) focusMonth(last.index)
      return
    }
    if (!delta) return
    const next = nextEnabledIndex(focusedIndex, delta, visibleYear, min, max)
    if (next === focusedIndex) return
    event.preventDefault()
    focusMonth(next)
  }

  return (
    <IrisPopover open={open} onOpenChange={setOpen} placement={placement}>
      <IrisPopoverTrigger asChild>
        <button
          type="button"
          id={id}
          className={className}
          disabled={disabled || undefined}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={ariaDescribedby}
          {...rest}
          data-iris-month-picker-trigger=""
          data-iris-month-picker-value={selectedValue}
          data-state={open ? 'open' : 'closed'}
          style={{
            ...triggerBaseStyle,
            color: selectedValue ? 'var(--iris-foreground)' : 'var(--iris-muted)',
            border: `1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            ...style,
          }}
        >
          {display || placeholder || t('monthPicker.placeholder')}
        </button>
      </IrisPopoverTrigger>
      <IrisPopoverContent autoFocus={false} style={{ padding: 0 }}>
        <div
          ref={panelRef}
          data-iris-month-picker-panel=""
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--iris-space-sm, 12px)',
            padding: 'var(--iris-padding-sm, 8px)',
            minWidth: '18rem',
          }}
        >
          <div
            data-iris-month-picker-header=""
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--iris-space-xs, 8px)',
            }}
          >
            <button
              type="button"
              aria-label={t('monthPicker.previousYear')}
              data-iris-month-picker-prev=""
              disabled={disabled || previousYearDisabled || undefined}
              onClick={() => moveYear(-1)}
              style={{
                ...yearButtonStyle,
                opacity: previousYearDisabled ? 0.4 : 1,
                cursor: disabled || previousYearDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              ‹
            </button>
            <strong
              data-iris-month-picker-year=""
              aria-live="polite"
              style={{
                color: 'var(--iris-foreground)',
                fontSize: 'var(--iris-font-size-md, 14px)',
                lineHeight: 'var(--iris-font-line-height-md, 1.5)',
              }}
            >
              {visibleYear}
            </strong>
            <button
              type="button"
              aria-label={t('monthPicker.nextYear')}
              data-iris-month-picker-next=""
              disabled={disabled || nextYearDisabled || undefined}
              onClick={() => moveYear(1)}
              style={{
                ...yearButtonStyle,
                opacity: nextYearDisabled ? 0.4 : 1,
                cursor: disabled || nextYearDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              ›
            </button>
          </div>
          <div
            role="radiogroup"
            aria-label={t('monthPicker.months', { year: visibleYear })}
            data-iris-month-picker-grid=""
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 'var(--iris-space-xs, 8px)',
            }}
          >
            {months.map((month) => {
              const selected = month.value === selectedValue
              const monthDisabled = isOutOfMonthRange(month.date, min, max)
              return (
                <button
                  key={month.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={month.label}
                  data-iris-month-picker-month={month.value}
                  disabled={disabled || monthDisabled || undefined}
                  tabIndex={month.index === focusedIndex ? 0 : -1}
                  onFocus={() => setFocusedIndex(month.index)}
                  onKeyDown={handleMonthKeyDown}
                  onClick={() => selectMonth(month.index)}
                  style={{
                    ...monthButtonStyle,
                    background: selected ? 'var(--iris-primary)' : 'transparent',
                    color: selected ? 'var(--iris-primary-foreground)' : 'var(--iris-foreground)',
                    cursor: disabled || monthDisabled ? 'not-allowed' : 'pointer',
                    opacity: monthDisabled ? 0.45 : 1,
                  }}
                >
                  {month.label}
                </button>
              )
            })}
          </div>
        </div>
      </IrisPopoverContent>
    </IrisPopover>
  )
}
