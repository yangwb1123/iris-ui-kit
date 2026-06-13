import { createSignal, createMemo, mergeProps, splitProps, Show, type JSX } from 'solid-js'
import { IrisCalendar } from '../calendar/IrisCalendar'
import { startOfDay } from '../calendar/dateUtils'
import { useI18n } from '../../i18n'

function formatDisplay(date: Date | null | undefined, locale?: string): string {
  if (!date) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

export interface IrisDateRange {
  start: Date | null
  end: Date | null
}

export interface IrisDateRangePickerProps {
  value?: IrisDateRange
  defaultValue?: IrisDateRange
  min?: Date
  max?: Date
  weekStartsOn?: number
  locale?: string
  placeholder?: string
  disabled?: boolean
  onChange?: (range: IrisDateRange) => void
}

/**
 * Date range picker: two input buttons + dual calendar panel for [start, end].
 * Solid port of the Vue IrisDateRangePicker.
 */
export function IrisDateRangePicker(props: IrisDateRangePickerProps): JSX.Element {
  const merged = mergeProps(
    {
      defaultValue: { start: null, end: null } as IrisDateRange,
      disabled: false,
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
    'onChange',
  ])

  const { t } = useI18n()

  const [internalValue, setInternalValue] = createSignal<IrisDateRange>(local.defaultValue)
  const [open, setOpen] = createSignal(false)
  const [selecting, setSelecting] = createSignal<'start' | 'end'>('start')

  const currentValue = (): IrisDateRange =>
    local.value !== undefined ? local.value : internalValue()

  const displayStart = createMemo(() => formatDisplay(currentValue().start, local.locale))
  const displayEnd = createMemo(() => formatDisplay(currentValue().end, local.locale))

  const onSelect = (date: Date | null) => {
    if (!date) return
    const d = startOfDay(date)
    const current = currentValue()

    if (selecting() === 'start') {
      const newRange = { start: d, end: current.end && current.end >= d ? current.end : null }
      if (local.value === undefined) setInternalValue(newRange)
      local.onChange?.(newRange)
      setSelecting('end')
    } else {
      let newRange: IrisDateRange
      if (current.start && d < current.start) {
        newRange = { start: d, end: current.start }
      } else {
        newRange = { start: current.start, end: d }
      }
      if (local.value === undefined) setInternalValue(newRange)
      local.onChange?.(newRange)
      setOpen(false)
      setSelecting('start')
    }
  }

  return (
    <div
      data-iris-date-range-picker=""
      style={{ position: 'relative', display: 'inline-flex', gap: '4px', 'align-items': 'center' }}
    >
      <button
        type="button"
        disabled={local.disabled || undefined}
        aria-haspopup="dialog"
        aria-expanded={open()}
        data-iris-date-range-picker-start=""
        data-state={open() && selecting() === 'start' ? 'selecting' : 'idle'}
        onClick={() => {
          if (local.disabled) return
          setSelecting('start')
          setOpen(true)
        }}
        style={{
          padding: '6px 12px',
          background: 'var(--iris-surface)',
          border: '1px solid var(--iris-border)',
          'border-radius': 'var(--iris-radius-md, 6px)',
          color: displayStart() ? 'var(--iris-foreground)' : 'var(--iris-muted)',
          'font-size': '14px',
          'font-family': 'inherit',
          cursor: local.disabled ? 'not-allowed' : 'pointer',
          'min-width': '120px',
        }}
      >
        {displayStart() || (local.placeholder ?? t('dateRangePicker.start'))}
      </button>
      <span aria-hidden="true" style={{ color: 'var(--iris-muted)' }}>
        →
      </span>
      <button
        type="button"
        disabled={local.disabled || undefined}
        aria-haspopup="dialog"
        aria-expanded={open()}
        data-iris-date-range-picker-end=""
        data-state={open() && selecting() === 'end' ? 'selecting' : 'idle'}
        onClick={() => {
          if (local.disabled) return
          setSelecting('end')
          setOpen(true)
        }}
        style={{
          padding: '6px 12px',
          background: 'var(--iris-surface)',
          border: '1px solid var(--iris-border)',
          'border-radius': 'var(--iris-radius-md, 6px)',
          color: displayEnd() ? 'var(--iris-foreground)' : 'var(--iris-muted)',
          'font-size': '14px',
          'font-family': 'inherit',
          cursor: local.disabled ? 'not-allowed' : 'pointer',
          'min-width': '120px',
        }}
      >
        {displayEnd() || (local.placeholder ?? t('dateRangePicker.end'))}
      </button>

      <Show when={open()}>
        <div
          role="dialog"
          data-iris-date-range-picker-panel=""
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
            value={selecting() === 'start' ? currentValue().start : currentValue().end}
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
