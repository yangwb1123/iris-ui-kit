import { createSignal, createMemo, mergeProps, splitProps, Show, type JSX } from 'solid-js'
import { IrisCalendar } from '../calendar/IrisCalendar'
import { formatLocalISO } from '../calendar/dateUtils'
import { useI18n } from '../../i18n'

function formatDisplay(date: Date | null | undefined, locale?: string): string {
  if (!date) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
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
  ])

  const { t } = useI18n()

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
        data-iris-date-picker-trigger=""
        data-iris-date-picker-iso={currentValue() ? formatLocalISO(currentValue()!) : undefined}
        data-state={open() ? 'open' : 'closed'}
        onClick={() => !local.disabled && setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          'align-items': 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--iris-surface)',
          border: `1px solid ${local.invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`,
          'border-radius': 'var(--iris-radius-md, 6px)',
          color: display() ? 'var(--iris-foreground)' : 'var(--iris-muted)',
          'font-size': '14px',
          'font-family': 'inherit',
          cursor: local.disabled ? 'not-allowed' : 'pointer',
          opacity: local.disabled ? '0.5' : '1',
          'min-width': '160px',
        }}
      >
        <span style={{ flex: '1', 'text-align': 'start' }}>
          {display() || (local.placeholder ?? t('datePicker.placeholder'))}
        </span>
        <span aria-hidden="true" style={{ 'font-size': '16px' }}>
          📅
        </span>
      </button>

      <Show when={open()}>
        <div
          data-iris-date-picker-panel=""
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            'z-index': '100',
            'margin-top': '4px',
            'box-shadow': '0 4px 16px rgba(0,0,0,0.12)',
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
