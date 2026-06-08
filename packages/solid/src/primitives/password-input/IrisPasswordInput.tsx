import { createSignal, mergeProps, Show, splitProps, type JSX } from 'solid-js'
import type { Size } from '@iris-ui/core'

export type IrisPasswordInputSize = Size

const SIZE_STYLES: Record<
  IrisPasswordInputSize,
  { padding: string; fontSize: string; minHeight: string }
> = {
  sm: { padding: '4px var(--iris-padding-sm, 8px)', fontSize: '12px', minHeight: '28px' },
  md: { padding: '6px var(--iris-padding-md, 12px)', fontSize: '14px', minHeight: '34px' },
  lg: { padding: '8px var(--iris-padding-md, 12px)', fontSize: '16px', minHeight: '40px' },
}

export interface IrisPasswordInputProps {
  value?: string
  defaultValue?: string
  size?: IrisPasswordInputSize
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  invalid?: boolean
  showToggle?: boolean
  id?: string
  ariaDescribedby?: string
  onChange?: (value: string) => void
  onFocus?: (e: FocusEvent) => void
  onBlur?: (e: FocusEvent) => void
  style?: JSX.CSSProperties | string
  class?: string
}

/** Solid port of IrisPasswordInput — password field with show/hide toggle. */
export function IrisPasswordInput(props: IrisPasswordInputProps): JSX.Element {
  const merged = mergeProps({ size: 'md' as IrisPasswordInputSize, showToggle: true }, props)
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'size',
    'placeholder',
    'disabled',
    'readonly',
    'invalid',
    'showToggle',
    'id',
    'ariaDescribedby',
    'onChange',
    'onFocus',
    'onBlur',
    'style',
  ])

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal(local.defaultValue ?? '')
  const current = (): string => (isControlled() ? (local.value as string) : internal())

  const [focused, setFocused] = createSignal(false)
  const [visible, setVisible] = createSignal(false)

  const toggle = () => {
    if (local.disabled || local.readonly) return
    setVisible((v) => !v)
  }

  const onInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value
    if (!isControlled()) setInternal(v)
    local.onChange?.(v)
  }

  const onFocus = (e: FocusEvent) => {
    setFocused(true)
    local.onFocus?.(e)
  }

  const onBlur = (e: FocusEvent) => {
    setFocused(false)
    local.onBlur?.(e)
  }

  const sz = (): (typeof SIZE_STYLES)[IrisPasswordInputSize] => SIZE_STYLES[local.size]

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

  return (
    <div
      {...rest}
      data-iris-password-input=""
      data-iris-password-input-size={local.size}
      data-state={local.invalid ? 'invalid' : focused() ? 'focused' : 'idle'}
      style={wrapperStyle()}
    >
      <input
        id={local.id}
        type={visible() ? 'text' : 'password'}
        value={current()}
        placeholder={local.placeholder}
        disabled={local.disabled}
        readOnly={local.readonly}
        aria-invalid={local.invalid ? 'true' : undefined}
        aria-describedby={local.ariaDescribedby}
        style={{
          flex: '1',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'inherit',
          'font-family': 'inherit',
          'font-size': 'inherit',
          padding: '0',
          'min-width': '0',
        }}
        onInput={onInput}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <Show when={local.showToggle}>
        <button
          type="button"
          data-iris-password-input-toggle=""
          aria-label={visible() ? 'Hide password' : 'Show password'}
          aria-pressed={visible() ? 'true' : 'false'}
          onClick={toggle}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: local.disabled ? 'not-allowed' : 'pointer',
            color: 'var(--iris-muted)',
            padding: '0 2px',
            'font-size': '13px',
            'line-height': '1',
          }}
        >
          {visible() ? '🙈' : '👁'}
        </button>
      </Show>
    </div>
  )
}
