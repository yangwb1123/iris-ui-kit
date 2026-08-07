import { createSignal, mergeProps, Show, splitProps, type JSX } from 'solid-js'
import type { Size } from '@iris-ui-kit/core'
import { useI18n } from '../../i18n'

export type IrisNumberInputSize = Size

function decimalsOf(step: number): number {
  if (!Number.isFinite(step)) return 0
  const s = step.toString()
  const dot = s.indexOf('.')
  return dot < 0 ? 0 : s.length - dot - 1
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundToStep(value: number, step: number): number {
  const places = decimalsOf(step)
  return Number(value.toFixed(places))
}

const SIZE_STYLES: Record<
  IrisNumberInputSize,
  { padding: string; fontSize: string; minHeight: string }
> = {
  sm: {
    padding: '4px var(--iris-padding-sm, 8px)',
    fontSize: 'var(--iris-font-size-xs, 12px)',
    minHeight: '28px',
  },
  md: {
    padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: '34px',
  },
  lg: {
    padding: '8px var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-lg, 16px)',
    minHeight: '40px',
  },
}

export interface IrisNumberInputProps {
  value?: number | null
  defaultValue?: number | null
  size?: IrisNumberInputSize
  min?: number
  max?: number
  step?: number
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  invalid?: boolean
  showControls?: boolean
  id?: string
  ariaDescribedby?: string
  onChange?: (value: number | null) => void
  onFocus?: (e: FocusEvent) => void
  onBlur?: (e: FocusEvent) => void
  style?: JSX.CSSProperties | string
  class?: string
}

/** Solid port of IrisNumberInput — numeric input with step buttons. */
export function IrisNumberInput(props: IrisNumberInputProps): JSX.Element {
  const merged = mergeProps(
    {
      size: 'md' as IrisNumberInputSize,
      min: -Infinity,
      max: Infinity,
      step: 1,
      showControls: true,
    },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'size',
    'min',
    'max',
    'step',
    'placeholder',
    'disabled',
    'readonly',
    'invalid',
    'showControls',
    'id',
    'ariaDescribedby',
    'onChange',
    'onFocus',
    'onBlur',
    'style',
  ])

  const { t } = useI18n()

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal<number | null>(
    local.defaultValue !== undefined ? local.defaultValue : null,
  )
  const current = (): number | null => (isControlled() ? (local.value ?? null) : internal())

  const [rawText, setRawText] = createSignal<string>(current() === null ? '' : String(current()))
  const [focused, setFocused] = createSignal(false)

  const startValue = (): number =>
    Number.isFinite(local.min) && local.min !== -Infinity ? local.min : 0

  const setValue = (next: number | null): void => {
    if (next === null) {
      setRawText('')
      if (!isControlled()) setInternal(null)
      local.onChange?.(null)
      return
    }
    const clamped = clamp(next, local.min, local.max)
    const rounded = roundToStep(clamped, local.step)
    setRawText(String(rounded))
    if (!isControlled()) setInternal(rounded)
    local.onChange?.(rounded)
  }

  const increment = (factor: 1 | -1): void => {
    if (local.disabled || local.readonly) return
    const base = current() === null ? startValue() : current()!
    setValue(base + factor * local.step)
  }

  const onInput = (e: Event) => {
    const text = (e.target as HTMLInputElement).value
    setRawText(text)
    if (text === '' || text === '-') {
      if (!isControlled()) setInternal(null)
      local.onChange?.(null)
      return
    }
    const parsed = Number(text)
    if (Number.isNaN(parsed)) {
      if (!isControlled()) setInternal(null)
      local.onChange?.(null)
      return
    }
    if (!isControlled()) setInternal(parsed)
    local.onChange?.(parsed)
  }

  const onBlur = (e: FocusEvent) => {
    setFocused(false)
    const cur = current()
    if (cur !== null) {
      const clamped = clamp(cur, local.min, local.max)
      const rounded = roundToStep(clamped, local.step)
      setRawText(String(rounded))
      if (!isControlled()) setInternal(rounded)
    }
    local.onBlur?.(e)
  }

  const onFocus = (e: FocusEvent) => {
    setFocused(true)
    local.onFocus?.(e)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      increment(1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      increment(-1)
    }
  }

  const sz = (): (typeof SIZE_STYLES)[IrisNumberInputSize] => SIZE_STYLES[local.size]

  const borderColor = (): string =>
    local.invalid ? 'var(--iris-danger)' : focused() ? 'var(--iris-primary)' : 'var(--iris-border)'

  const boxShadow = (): string =>
    focused()
      ? `0 0 0 3px ${local.invalid ? 'rgba(239,68,68,0.18)' : 'rgba(99,102,241,0.18)'}`
      : 'none'

  const wrapperStyle = (): JSX.CSSProperties => ({
    display: 'inline-flex',
    'align-items': 'center',
    background: 'var(--iris-background)',
    color: 'var(--iris-foreground)',
    border: `1px solid ${borderColor()}`,
    'border-radius': 'var(--iris-radius-md, 6px)',
    opacity: local.disabled ? 0.6 : 1,
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
    'box-shadow': boxShadow(),
    padding: sz().padding,
    'min-height': sz().minHeight,
    'font-size': sz().fontSize,
    ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
  })

  const btnStyle: JSX.CSSProperties = {
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '22px',
    height: '22px',
    background: 'transparent',
    border: 'none',
    'border-radius': 'var(--iris-radius-sm, 4px)',
    cursor: 'pointer',
    color: 'var(--iris-muted)',
    'line-height': '1',
    'flex-shrink': '0',
  }

  const atMin = (): boolean => current() !== null && current()! <= local.min
  const atMax = (): boolean => current() !== null && current()! >= local.max

  return (
    <div
      {...rest}
      data-iris-number-input=""
      data-iris-number-input-size={local.size}
      data-state={local.invalid ? 'invalid' : focused() ? 'focused' : 'idle'}
      style={wrapperStyle()}
    >
      <Show when={local.showControls}>
        <button
          type="button"
          data-iris-number-input-dec=""
          aria-label={t('numberInput.decrement')}
          disabled={local.disabled || atMin() || undefined}
          onClick={() => increment(-1)}
          style={{ ...btnStyle, 'margin-inline-end': '4px' }}
        >
          −
        </button>
      </Show>
      <input
        id={local.id}
        type="text"
        inputMode="decimal"
        role="spinbutton"
        value={rawText()}
        placeholder={local.placeholder}
        disabled={local.disabled}
        readOnly={local.readonly}
        aria-invalid={local.invalid ? 'true' : undefined}
        aria-describedby={local.ariaDescribedby}
        aria-valuenow={current() === null ? undefined : current()!}
        aria-valuemin={Number.isFinite(local.min) ? local.min : undefined}
        aria-valuemax={Number.isFinite(local.max) ? local.max : undefined}
        style={{
          flex: '1',
          'min-width': '40px',
          width: '4ch',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'inherit',
          'font-family': 'inherit',
          'font-size': 'inherit',
          padding: '0',
          'text-align': 'end',
        }}
        onInput={onInput}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <Show when={local.showControls}>
        <button
          type="button"
          data-iris-number-input-inc=""
          aria-label={t('numberInput.increment')}
          disabled={local.disabled || atMax() || undefined}
          onClick={() => increment(1)}
          style={{ ...btnStyle, 'margin-inline-start': '4px' }}
        >
          +
        </button>
      </Show>
    </div>
  )
}
