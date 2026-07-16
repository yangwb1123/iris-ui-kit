import * as React from 'react'
import type { Placement } from '@iris-ui/core'
import { useI18n } from '../../i18n'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import { IrisPopoverContent } from '../popover/PopoverContent'
import { IrisCalendar } from '../calendar/Calendar'
import { formatLocalISO, safeLocale } from '../calendar/dateUtils'

function formatDisplay(date: Date | null, locale?: string): string {
  if (!date) return ''
  return new Intl.DateTimeFormat(safeLocale(locale), { dateStyle: 'medium' }).format(date)
}

export interface IrisDatePickerProps {
  value?: Date | null
  defaultValue?: Date | null
  onValueChange?: (next: Date | null) => void
  min?: Date
  max?: Date
  weekStartsOn?: number
  locale?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  placement?: Placement
  /** id forwarded to the trigger. Set by `IrisFormField`. */
  id?: string
  /** Forwarded as `aria-describedby` on the trigger. Set by `IrisFormField`. */
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Date picker: button-styled trigger + Popover + Calendar. On selection the
 * popover auto-closes. Use `IrisCalendar` directly when you want it inline.
 */
export function IrisDatePicker({
  value: valueProp,
  defaultValue,
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
}: IrisDatePickerProps): React.ReactElement {
  const { t } = useI18n()
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState<Date | null>(defaultValue ?? null)
  const value = isControlled ? (valueProp as Date | null) : internal
  const [open, setOpen] = React.useState(false)
  const display = formatDisplay(value, locale)

  const handleSelect = (next: Date | null) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
    if (next) setOpen(false)
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
          data-iris-date-picker-trigger=""
          data-iris-date-picker-iso={value ? formatLocalISO(value) : undefined}
          data-state={open ? 'open' : 'closed'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--iris-background)',
            color: value ? 'var(--iris-foreground)' : 'var(--iris-muted)',
            border: `1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
            borderRadius: 'var(--iris-radius-md, 6px)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            fontSize: 14,
            fontFamily: 'inherit',
            minHeight: 34,
            minWidth: 180,
            textAlign: 'start',
            ...style,
          }}
        >
          {display || (placeholder ?? t('datePicker.placeholder'))}
        </button>
      </IrisPopoverTrigger>
      <IrisPopoverContent autoFocus={false} style={{ padding: 0 }}>
        <IrisCalendar
          value={value}
          min={min}
          max={max}
          weekStartsOn={weekStartsOn}
          locale={locale}
          disabled={disabled}
          onValueChange={handleSelect}
          style={{ border: 'none', background: 'transparent' }}
        />
      </IrisPopoverContent>
    </IrisPopover>
  )
}
