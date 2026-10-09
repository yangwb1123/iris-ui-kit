import * as React from 'react'
import type { Placement } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'
import { useComponentSize, type IrisComponentSize } from '../../provider'
import { IrisPopover } from '../popover/Popover'
import { IrisPopoverTrigger } from '../popover/PopoverTrigger'
import { IrisPopoverContent } from '../popover/PopoverContent'
import { IrisCalendar } from '../calendar/Calendar'
import { formatLocalISO, safeLocale } from '../calendar/dateUtils'

function formatDisplay(date: Date | null, locale?: string): string {
  if (!date) return ''
  return new Intl.DateTimeFormat(safeLocale(locale), { dateStyle: 'medium' }).format(date)
}

/** Trigger metrics per size — the same scale the text controls use. */
const TRIGGER_SIZE: Record<
  IrisComponentSize,
  { padding: string; fontSize: string; minHeight: string }
> = {
  sm: {
    padding: '4px 8px',
    fontSize: 'var(--iris-font-size-xs, 12px)',
    minHeight: 'var(--iris-control-height-sm, 28px)',
  },
  md: {
    padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: 'var(--iris-control-height-md, 34px)',
  },
  lg: {
    padding: '8px 12px',
    fontSize: 'var(--iris-font-size-lg, 16px)',
    minHeight: 'var(--iris-control-height-lg, 40px)',
  },
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
  /**
   * Explicit size for the trigger. Omit to inherit the nearest
   * `<IrisProvider componentSize>` (`md` when there is none).
   */
  size?: IrisComponentSize
  /** id forwarded to the trigger. Set by `IrisFormField`. */
  id?: string
  /** Forwarded as `aria-describedby` on the trigger. Set by `IrisFormField`. */
  ariaDescribedby?: string
  style?: React.CSSProperties
  className?: string
  /** Trigger width — any CSS length, or a number of px. */
  width?: string | number
  /** Stretch the trigger to its container (`width: 100%`). */
  fullWidth?: boolean
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
  size: sizeProp,
  style,
  className,
  width,
  fullWidth = false,
  ...rest
}: IrisDatePickerProps): React.ReactElement {
  const { t } = useI18n()
  // Trigger adopts the inherited size; the calendar panel is unchanged.
  const size = useComponentSize(sizeProp)
  const triggerSize = TRIGGER_SIZE[size]
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
          data-iris-date-picker-size={size}
          data-iris-date-picker-iso={value ? formatLocalISO(value) : undefined}
          {...rest}
          data-state={open ? 'open' : 'closed'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--iris-space-xs, 8px)',
            padding: triggerSize.padding,
            background: 'var(--iris-background)',
            color: value ? 'var(--iris-foreground)' : 'var(--iris-muted)',
            border: `1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
            borderRadius: 'var(--iris-radius-md, 6px)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            fontSize: triggerSize.fontSize,
            fontFamily: 'inherit',
            minHeight: triggerSize.minHeight,
            minWidth: 180,
            boxSizing: 'border-box',
            textAlign: 'start',
            ...(fullWidth ? { width: '100%' } : null),
            ...(width !== undefined
              ? { width: typeof width === 'number' ? `${width}px` : width }
              : null),
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
