import { createSignal, mergeProps, Show, splitProps, type JSX } from 'solid-js'
import { useFormFieldControl } from '../form-field/context'

export type IrisInputSize = 'sm' | 'md' | 'lg'
export type IrisInputType = 'text' | 'password' | 'email' | 'number' | 'search' | 'tel' | 'url'

const SIZE_MAP: Record<IrisInputSize, { padding: string; fontSize: string; minHeight: string }> = {
  sm: { padding: '4px 8px', fontSize: 'var(--iris-font-size-xs, 12px)', minHeight: '28px' },
  md: {
    padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-md, 14px)',
    minHeight: '34px',
  },
  lg: { padding: '8px 12px', fontSize: 'var(--iris-font-size-lg, 16px)', minHeight: '40px' },
}

export interface IrisInputProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'type' | 'prefix'
> {
  size?: IrisInputSize
  type?: IrisInputType
  invalid?: boolean
  ariaDescribedby?: string
  prefix?: JSX.Element
  suffix?: JSX.Element
}

/** Solid port of the React/Vue IrisInput. Self-wires id/aria from IrisFormField. */
export function IrisInput(props: IrisInputProps): JSX.Element {
  const field = useFormFieldControl()
  const merged = mergeProps(
    { size: 'md' as IrisInputSize, type: 'text' as IrisInputType, invalid: false },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'size',
    'type',
    'invalid',
    'ariaDescribedby',
    'prefix',
    'suffix',
    'style',
    'id',
  ])
  const [focused, setFocused] = createSignal(false)

  const invalid = (): boolean => local.invalid || (field?.invalid() ?? false)
  const describedBy = (): string | undefined => local.ariaDescribedby ?? field?.describedBy()
  const controlId = (): string | undefined => local.id ?? field?.id()
  const sizeStyles = (): { padding: string; fontSize: string; minHeight: string } =>
    SIZE_MAP[local.size]

  const borderColor = (): string =>
    invalid() ? 'var(--iris-danger)' : focused() ? 'var(--iris-primary)' : 'var(--iris-border)'

  return (
    <label
      data-iris-input=""
      data-iris-input-size={local.size}
      data-state={invalid() ? 'invalid' : focused() ? 'focused' : 'idle'}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        gap: 'var(--iris-space-xs, 8px)',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: `1px solid ${borderColor()}`,
        'border-radius': 'var(--iris-radius-md, 6px)',
        cursor: rest.disabled ? 'not-allowed' : 'text',
        opacity: rest.disabled ? 0.6 : 1,
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        'box-shadow': focused()
          ? `0 0 0 3px ${invalid() ? 'rgba(239, 68, 68, 0.18)' : 'rgba(99, 102, 241, 0.18)'}`
          : 'none',
        padding: sizeStyles().padding,
        'min-height': sizeStyles().minHeight,
        'font-size': sizeStyles().fontSize,
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <Show when={local.prefix}>
        <span
          data-iris-input-prefix=""
          style={{ display: 'inline-flex', 'align-items': 'center', color: 'var(--iris-muted)' }}
        >
          {local.prefix}
        </span>
      </Show>
      <input
        {...rest}
        id={controlId()}
        type={local.type}
        aria-invalid={invalid() ? 'true' : undefined}
        aria-describedby={describedBy()}
        style={{
          flex: 1,
          'min-width': 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'inherit',
          'font-family': 'inherit',
          'font-size': 'inherit',
          padding: 0,
        }}
        onFocus={(e) => {
          setFocused(true)
          if (typeof rest.onFocus === 'function') (rest.onFocus as (ev: typeof e) => void)(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          if (typeof rest.onBlur === 'function') (rest.onBlur as (ev: typeof e) => void)(e)
        }}
      />
      <Show when={local.suffix}>
        <span
          data-iris-input-suffix=""
          style={{ display: 'inline-flex', 'align-items': 'center', color: 'var(--iris-muted)' }}
        >
          {local.suffix}
        </span>
      </Show>
    </label>
  )
}
