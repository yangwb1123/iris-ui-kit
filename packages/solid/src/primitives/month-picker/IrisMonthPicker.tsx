import {
  createEffect,
  createMemo,
  createSignal,
  mergeProps,
  onCleanup,
  Show,
  splitProps,
  type JSX,
} from 'solid-js'
import { useI18n } from '../../i18n'
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

function formatDisplay(date: Date | null | undefined, locale?: string): string {
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

export interface IrisMonthPickerProps {
  value?: Date | null
  defaultValue?: Date | null
  /** Initial visible year when no value is selected. */
  defaultMonth?: Date | null
  /** Inclusive month bounds; individual days are ignored. */
  min?: Date
  max?: Date
  locale?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  id?: string
  ariaDescribedby?: string
  class?: string
  style?: JSX.CSSProperties
  onChange?: (date: Date | null) => void
}

/** Month-only picker with a twelve-cell grid and local-time Date output. */
export function IrisMonthPicker(props: IrisMonthPickerProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultValue: null as Date | null,
      defaultMonth: null as Date | null,
      disabled: false,
      invalid: false,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'defaultMonth',
    'min',
    'max',
    'locale',
    'placeholder',
    'disabled',
    'invalid',
    'id',
    'ariaDescribedby',
    'class',
    'style',
    'onChange',
  ])
  const { t } = useI18n()
  const [internalValue, setInternalValue] = createSignal<Date | null>(
    isValidDate(local.defaultValue) ? startOfMonth(local.defaultValue) : null,
  )
  const currentValue = () => (local.value !== undefined ? local.value : internalValue())
  const initialMonth = isValidDate(currentValue())
    ? currentValue()!
    : isValidDate(local.defaultMonth)
      ? local.defaultMonth!
      : new Date()
  const [visibleYear, setVisibleYear] = createSignal(initialMonth.getFullYear())
  const [focusedIndex, setFocusedIndex] = createSignal(
    isValidDate(currentValue()) ? currentValue()!.getMonth() : 0,
  )
  const [open, setOpen] = createSignal(false)
  let containerEl: HTMLDivElement | undefined
  const monthButtons: Record<string, HTMLButtonElement> = {}

  createEffect(() => {
    const value = currentValue()
    if (!isValidDate(value)) return
    setVisibleYear(value.getFullYear())
    setFocusedIndex(value.getMonth())
  })

  createEffect(() => {
    if (!open()) return
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (containerEl && !containerEl.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentMouseDown)
    onCleanup(() => document.removeEventListener('mousedown', onDocumentMouseDown))
  })

  const selectedValue = createMemo(() => {
    const value = currentValue()
    return isValidDate(value) ? formatLocalYearMonth(startOfMonth(value)) : undefined
  })
  const display = createMemo(() => formatDisplay(currentValue(), local.locale))
  const months = createMemo<MonthOption[]>(() =>
    Array.from({ length: 12 }, (_, index) => {
      const date = monthAt(visibleYear(), index)
      return {
        date,
        index,
        label: formatMonthLabel(date, local.locale),
        value: formatLocalYearMonth(date),
      }
    }),
  )
  const previousYearDisabled = createMemo(
    () => !yearHasSelectableMonth(visibleYear() - 1, local.min, local.max),
  )
  const nextYearDisabled = createMemo(
    () => !yearHasSelectableMonth(visibleYear() + 1, local.min, local.max),
  )

  const focusMonth = (index: number): void => {
    setFocusedIndex(index)
    queueMicrotask(() => monthButtons[months()[index]?.value ?? '']?.focus())
  }
  const selectMonth = (index: number): void => {
    if (local.disabled) return
    const date = monthAt(visibleYear(), index)
    if (isOutOfMonthRange(date, local.min, local.max)) return
    const next = startOfMonth(date)
    if (local.value === undefined) setInternalValue(next)
    local.onChange?.(next)
    setOpen(false)
  }
  const moveYear = (offset: number): void => {
    if (local.disabled) return
    const nextYear = visibleYear() + offset
    if (!yearHasSelectableMonth(nextYear, local.min, local.max)) return
    setVisibleYear(nextYear)
    if (isOutOfMonthRange(monthAt(nextYear, focusedIndex()), local.min, local.max)) {
      const first = Array.from({ length: 12 }, (_, index) => index).find(
        (index) => !isOutOfMonthRange(monthAt(nextYear, index), local.min, local.max),
      )
      if (first !== undefined) setFocusedIndex(first)
    }
  }
  const handleMonthKeyDown = (event: KeyboardEvent): void => {
    let delta = 0
    if (event.key === 'ArrowLeft') delta = -1
    if (event.key === 'ArrowRight') delta = 1
    if (event.key === 'ArrowUp') delta = -3
    if (event.key === 'ArrowDown') delta = 3
    if (event.key === 'Home') {
      event.preventDefault()
      const first = months().find((month) => !isOutOfMonthRange(month.date, local.min, local.max))
      if (first) focusMonth(first.index)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      const last = [...months()]
        .reverse()
        .find((month) => !isOutOfMonthRange(month.date, local.min, local.max))
      if (last) focusMonth(last.index)
      return
    }
    if (!delta) return
    const next = nextEnabledIndex(focusedIndex(), delta, visibleYear(), local.min, local.max)
    if (next === focusedIndex()) return
    event.preventDefault()
    focusMonth(next)
  }

  return (
    <div
      {...rest}
      ref={containerEl}
      data-iris-month-picker=""
      class={local.class}
      style={{ position: 'relative', display: 'inline-block', ...local.style }}
    >
      <button
        type="button"
        id={local.id}
        disabled={local.disabled || undefined}
        aria-invalid={local.invalid ? 'true' : undefined}
        aria-describedby={local.ariaDescribedby}
        aria-haspopup="dialog"
        aria-expanded={open()}
        data-iris-month-picker-trigger=""
        data-iris-month-picker-value={selectedValue()}
        data-state={open() ? 'open' : 'closed'}
        onClick={() => !local.disabled && setOpen((value) => !value)}
        style={{
          display: 'inline-flex',
          'align-items': 'center',
          padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
          background: 'var(--iris-background)',
          color: selectedValue() ? 'var(--iris-foreground)' : 'var(--iris-muted)',
          border: `1px solid ${local.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
          'border-radius': 'var(--iris-radius-md, 6px)',
          cursor: local.disabled ? 'not-allowed' : 'pointer',
          opacity: local.disabled ? '0.6' : '1',
          'font-size': 'var(--iris-font-size-md, 14px)',
          'font-family': 'inherit',
          'min-height': 'var(--iris-control-height-md, 34px)',
          'min-width': '180px',
          'text-align': 'start',
        }}
      >
        {display() || local.placeholder || t('monthPicker.placeholder')}
      </button>

      <Show when={open()}>
        <div
          role="dialog"
          aria-modal="true"
          data-iris-month-picker-content=""
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            'inset-inline-start': '0',
            'z-index': '50',
            background: 'var(--iris-surface-floating)',
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            'border-radius': 'var(--iris-radius-md, 6px)',
            padding: 'var(--iris-padding-sm, 8px)',
            'box-shadow': 'var(--iris-shadow-lg)',
            'min-width': '18rem',
          }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <div
            data-iris-month-picker-panel=""
            style={{
              display: 'flex',
              'flex-direction': 'column',
              gap: 'var(--iris-space-sm, 12px)',
            }}
          >
            <div
              data-iris-month-picker-header=""
              style={{
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'space-between',
                gap: 'var(--iris-space-xs, 8px)',
              }}
            >
              <button
                type="button"
                aria-label={t('monthPicker.previousYear')}
                data-iris-month-picker-prev=""
                disabled={local.disabled || previousYearDisabled() || undefined}
                onClick={() => moveYear(-1)}
                style={{
                  width: '32px',
                  height: '32px',
                  padding: '0',
                  background: 'transparent',
                  color: 'var(--iris-foreground)',
                  border: '1px solid transparent',
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                  cursor: local.disabled || previousYearDisabled() ? 'not-allowed' : 'pointer',
                }}
              >
                ‹
              </button>
              <strong
                data-iris-month-picker-year=""
                aria-live="polite"
                style={{
                  // Same typography contract as React/Vue: the year header must
                  // not inherit the trigger's font size, or the four adapters
                  // render the same control at different heights.
                  color: 'var(--iris-foreground)',
                  'font-size': 'var(--iris-font-size-md, 14px)',
                  'line-height': 'var(--iris-font-line-height-md, 1.5)',
                }}
              >
                {visibleYear()}
              </strong>
              <button
                type="button"
                aria-label={t('monthPicker.nextYear')}
                data-iris-month-picker-next=""
                disabled={local.disabled || nextYearDisabled() || undefined}
                onClick={() => moveYear(1)}
                style={{
                  width: '32px',
                  height: '32px',
                  padding: '0',
                  background: 'transparent',
                  color: 'var(--iris-foreground)',
                  border: '1px solid transparent',
                  'border-radius': 'var(--iris-radius-sm, 4px)',
                  cursor: local.disabled || nextYearDisabled() ? 'not-allowed' : 'pointer',
                }}
              >
                ›
              </button>
            </div>
            <div
              role="radiogroup"
              aria-label={t('monthPicker.months', { year: visibleYear() })}
              data-iris-month-picker-grid=""
              style={{
                display: 'grid',
                'grid-template-columns': 'repeat(3, minmax(0, 1fr))',
                gap: 'var(--iris-space-xs, 8px)',
              }}
            >
              {months().map((month) => {
                const selected = month.value === selectedValue()
                const monthDisabled = isOutOfMonthRange(month.date, local.min, local.max)
                return (
                  <button
                    ref={(element) => {
                      monthButtons[month.value] = element
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={month.label}
                    data-iris-month-picker-month={month.value}
                    disabled={local.disabled || monthDisabled || undefined}
                    tabIndex={month.index === focusedIndex() ? 0 : -1}
                    onFocus={() => setFocusedIndex(month.index)}
                    onKeyDown={handleMonthKeyDown}
                    onClick={() => selectMonth(month.index)}
                    style={{
                      display: 'inline-flex',
                      'align-items': 'center',
                      'justify-content': 'center',
                      width: '100%',
                      'min-height': 'var(--iris-control-height-sm, 28px)',
                      padding: 'var(--iris-space-xs, 8px)',
                      background: selected ? 'var(--iris-primary)' : 'transparent',
                      color: selected ? 'var(--iris-primary-foreground)' : 'var(--iris-foreground)',
                      border: '1px solid var(--iris-border)',
                      'border-radius': 'var(--iris-radius-sm, 4px)',
                      cursor: local.disabled || monthDisabled ? 'not-allowed' : 'pointer',
                      opacity: monthDisabled ? '0.45' : '1',
                      'font-family': 'inherit',
                      'white-space': 'nowrap',
                    }}
                  >
                    {month.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Show>
    </div>
  )
}
