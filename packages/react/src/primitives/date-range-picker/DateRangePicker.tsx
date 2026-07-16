import * as React from 'react'
import type { Placement } from '@iris-ui/core'
import { useI18n } from '../../i18n'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import { IrisPopoverContent } from '../popover/PopoverContent'
import { IrisCalendar } from '../calendar/Calendar'
import { addMonths, safeLocale, startOfDay, startOfMonth } from '../calendar/dateUtils'

export interface IrisDateRange {
  start: Date | null
  end: Date | null
}

function formatDisplay(d: Date | null, locale?: string): string {
  if (!d) return ''
  return new Intl.DateTimeFormat(safeLocale(locale), { dateStyle: 'medium' }).format(d)
}

export interface IrisDateRangePickerProps {
  value?: IrisDateRange | null
  defaultValue?: IrisDateRange
  onValueChange?: (next: IrisDateRange) => void
  min?: Date
  max?: Date
  weekStartsOn?: number
  locale?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  placement?: Placement
  id?: string
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Range date picker. Trigger displays `start → end`; popover contains two
 * month calendars (current + next).
 *
 * Click order: first click → sets `start`. Second click → sets `end`
 * (auto-swaps if before `start`). Popover closes on completion.
 */
export function IrisDateRangePicker({
  value: valueProp,
  defaultValue = { start: null, end: null },
  onValueChange,
  min,
  max,
  weekStartsOn = 0,
  locale,
  placeholder,
  disabled = false,
  invalid = false,
  placement = 'bottom-start',
  id,
  ariaDescribedby,
  style,
  className,
}: IrisDateRangePickerProps): React.ReactElement {
  const { t } = useI18n()
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<IrisDateRange>(defaultValue)
  const value = isControlled ? (valueProp ?? { start: null, end: null }) : internal
  const [open, setOpen] = React.useState(false)

  const leftMonth = React.useMemo(
    () => (value.start ? startOfMonth(value.start) : startOfMonth(new Date())),
    [value.start],
  )

  const display = React.useMemo(() => {
    const s = formatDisplay(value.start, locale)
    const e = formatDisplay(value.end, locale)
    if (s && e) return `${s}  →  ${e}`
    if (s) return `${s}  →  …`
    return ''
  }, [value.start, value.end, locale])

  const setRange = (next: IrisDateRange) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  const handleSelect = (next: Date | null) => {
    if (!next) return
    const d = startOfDay(next)
    if (!value.start || (value.start && value.end)) {
      setRange({ start: d, end: null })
      return
    }
    let s = value.start
    let e = d
    if (e < s) [s, e] = [e, s]
    setRange({ start: s, end: e })
    setOpen(false)
  }

  const previewSelected = value.end ?? value.start

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
          data-iris-date-range-picker-trigger=""
          data-state={open ? 'open' : 'closed'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 12px',
            background: 'var(--iris-background)',
            color: display ? 'var(--iris-foreground)' : 'var(--iris-muted)',
            border: `1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
            borderRadius: 'var(--iris-radius-md, 6px)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            fontSize: 14,
            fontFamily: 'inherit',
            minHeight: 34,
            minWidth: 260,
            textAlign: 'start',
            ...style,
          }}
        >
          {display || (placeholder ?? t('dateRangePicker.placeholder'))}
        </button>
      </IrisPopoverTrigger>
      <IrisPopoverContent autoFocus={false} style={{ padding: 0 }}>
        <div data-iris-date-range-picker-pane="" style={{ display: 'flex', gap: 8 }}>
          <IrisCalendar
            value={previewSelected}
            defaultMonth={leftMonth}
            min={min}
            max={max}
            weekStartsOn={weekStartsOn}
            locale={locale}
            disabled={disabled}
            onValueChange={handleSelect}
            style={{ border: 'none' }}
          />
          <IrisCalendar
            value={previewSelected}
            defaultMonth={addMonths(leftMonth, 1)}
            min={min}
            max={max}
            weekStartsOn={weekStartsOn}
            locale={locale}
            disabled={disabled}
            onValueChange={handleSelect}
            style={{ border: 'none' }}
          />
        </div>
      </IrisPopoverContent>
    </IrisPopover>
  )
}
