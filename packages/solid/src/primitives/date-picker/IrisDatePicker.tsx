import { createSignal, createMemo, mergeProps, splitProps, Show, type JSX } from 'solid-js'
import { IrisCalendar } from '../calendar/IrisCalendar'
import { formatLocalISO, safeLocale } from '../calendar/dateUtils'
import { useI18n } from '../../i18n'
import { useComponentSize, type IrisComponentSize } from '../../provider'

function formatDisplay(date: Date | null | undefined, locale?: string): string {
  if (!date) return ''
  return new Intl.DateTimeFormat(safeLocale(locale), { dateStyle: 'medium' }).format(date)
}

/** Trigger metrics per size — the same scale the text controls use. */
const TRIGGER_SIZE: Record<IrisComponentSize, { padding: string; fontSize: string }> = {
  sm: {
    padding: 'var(--iris-padding-sm, 4px) var(--iris-padding-md, 8px)',
    fontSize: 'var(--iris-font-size-xs, 12px)',
  },
  md: {
    padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-md, 14px)',
  },
  lg: {
    padding: 'var(--iris-padding-sm, 8px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-lg, 16px)',
  },
}

export interface IrisDatePickerProps {
  value?: Date | null
  defaultValue?: Date | null
  min?: Date
  max?: Date
  weekStartsOn?: number
  locale?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  onChange?: (date: Date | null) => void
  id?: string
  /**
   * Explicit size for the trigger. Omit to inherit the nearest
   * `<IrisProvider componentSize>` (`md` when there is none).
   */
  size?: IrisComponentSize
  /** Trigger width — any CSS length, or a number of px. */
  width?: string | number
  /** Stretch the trigger to its container (`width: 100%`). */
  fullWidth?: boolean
  class?: string
  style?: JSX.CSSProperties | string
}

/**
 * Date picker: input-styled trigger + floating calendar panel.
 * Solid port of the Vue IrisDatePicker.
 */
export function IrisDatePicker(props: IrisDatePickerProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultValue: null as Date | null,
      disabled: false,
      invalid: false,
      weekStartsOn: 0,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'value',
    'defaultValue',
    'min',
    'max',
    'weekStartsOn',
    'locale',
    'placeholder',
    'disabled',
    'invalid',
    'onChange',
    'id',
    'size',
    'width',
    'fullWidth',
    'class',
    'style',
  ])

  const { t } = useI18n()
  // Trigger adopts the inherited size; the calendar panel is unchanged.
  const size = useComponentSize(() => local.size)

  const [internalValue, setInternalValue] = createSignal<Date | null>(local.defaultValue)
  const [open, setOpen] = createSignal(false)

  const currentValue = () => (local.value !== undefined ? local.value : internalValue())
  const display = createMemo(() => formatDisplay(currentValue(), local.locale))

  const onSelect = (date: Date | null) => {
    if (local.value === undefined) setInternalValue(date)
    local.onChange?.(date)
    if (date) setOpen(false)
  }

  return (
    <div data-iris-date-picker="" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        id={local.id}
        disabled={local.disabled || undefined}
        aria-invalid={local.invalid ? 'true' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open()}
        data-iris-date-picker-trigger=""
        data-iris-date-picker-size={size()}
        data-iris-date-picker-iso={currentValue() ? formatLocalISO(currentValue()!) : undefined}
        data-state={open() ? 'open' : 'closed'}
        onClick={() => !local.disabled && setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          'align-items': 'center',
          gap: '8px',
          padding: TRIGGER_SIZE[size()].padding,
          background: 'var(--iris-surface)',
          border: `1px solid ${local.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
          'border-radius': 'var(--iris-radius-md, 6px)',
          color: display() ? 'var(--iris-foreground)' : 'var(--iris-muted)',
          'font-size': TRIGGER_SIZE[size()].fontSize,
          'font-family': 'inherit',
          cursor: local.disabled ? 'not-allowed' : 'pointer',
          opacity: local.disabled ? '0.5' : '1',
          'min-width': '160px',
          'box-sizing': 'border-box',
          ...(local.fullWidth ? { width: '100%' } : null),
          ...(local.width !== undefined
            ? { width: typeof local.width === 'number' ? `${local.width}px` : local.width }
            : null),
          ...(typeof local.style === 'object' ? local.style : {}),
          ...(local.class ? { class: local.class } : null),
        }}
      >
        <span style={{ flex: '1', 'text-align': 'start' }}>
          {display() || (local.placeholder ?? t('datePicker.placeholder'))}
        </span>
        <span aria-hidden="true" style={{ 'font-size': 'var(--iris-font-size-lg, 16px)' }}>
          📅
        </span>
      </button>

      <Show when={open()}>
        <div
          role="dialog"
          data-iris-date-picker-panel=""
          style={{
            position: 'absolute',
            top: '100%',
            'inset-inline-start': '0',
            'z-index': '100',
            'margin-top': '4px',
            'box-shadow': 'var(--iris-shadow-lg)',
            'border-radius': 'var(--iris-radius-md, 6px)',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <IrisCalendar
            value={currentValue()}
            min={local.min}
            max={local.max}
            weekStartsOn={local.weekStartsOn}
            locale={local.locale}
            onChange={onSelect}
          />
        </div>
      </Show>
    </div>
  )
}
