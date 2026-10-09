import { createSignal, mergeProps, Show, splitProps, type JSX } from 'solid-js'
import { useFormFieldControl } from '../form-field/context'
import { useComponentSize } from '../../provider'

export type IrisInputSize = 'sm' | 'md' | 'lg'
export type IrisInputType = 'text' | 'password' | 'email' | 'number' | 'search' | 'tel' | 'url'

const SIZE_MAP: Record<IrisInputSize, { padding: string; fontSize: string; minHeight: string }> = {
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

/** CSS width value — numbers are px, strings pass through as authored. */
function cssWidth(width: string | number): string {
  return typeof width === 'number' ? `${width}px` : width
}

export interface IrisInputProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'type' | 'prefix'
> {
  /**
   * Explicit size. Omit to inherit the nearest `<IrisProvider componentSize>`
   * (`md` when there is none).
   */
  size?: IrisInputSize
  type?: IrisInputType
  invalid?: boolean
  ariaDescribedby?: string
  prefix?: JSX.Element
  suffix?: JSX.Element
  /** Host box width — any CSS length, or a number of px. */
  width?: string | number
  /** Stretch the host box to its container (`width: 100%`). */
  fullWidth?: boolean
}

/** Solid port of the React/Vue IrisInput. Self-wires id/aria from IrisFormField. */
export function IrisInput(props: IrisInputProps): JSX.Element {
  const field = useFormFieldControl()
  const merged = mergeProps({ type: 'text' as IrisInputType, invalid: false }, props)
  const [local, rest] = splitProps(merged, [
    'size',
    'type',
    'invalid',
    'ariaDescribedby',
    'prefix',
    'suffix',
    'readOnly',
    'style',
    'id',
    'width',
    'fullWidth',
  ])
  const [focused, setFocused] = createSignal(false)

  // No explicit `size` → nearest <IrisProvider componentSize>, else `md`.
  const size = useComponentSize(() => local.size)

  const invalid = (): boolean => local.invalid || (field?.invalid() ?? false)
  const describedBy = (): string | undefined => local.ariaDescribedby ?? field?.describedBy()
  const controlId = (): string | undefined => local.id ?? field?.id()
  const sizeStyles = (): { padding: string; fontSize: string; minHeight: string } =>
    SIZE_MAP[size()]

  const borderColor = (): string =>
    invalid() ? 'var(--iris-danger)' : focused() ? 'var(--iris-primary)' : 'var(--iris-border)'

  return (
    <label
      data-iris-input=""
      data-iris-input-size={size()}
      data-state={
        invalid() ? 'invalid' : focused() ? 'focused' : local.readOnly ? 'readonly' : 'idle'
      }
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        gap: 'var(--iris-space-xs, 8px)',
        ...(local.fullWidth || local.width !== undefined ? { 'box-sizing': 'border-box' } : null),
        background: local.readOnly ? 'var(--iris-surface)' : 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        border: `1px solid ${borderColor()}`,
        'border-radius': 'var(--iris-radius-md, 6px)',
        cursor: rest.disabled ? 'not-allowed' : local.readOnly ? 'default' : 'text',
        opacity: rest.disabled ? 0.6 : 1,
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        'box-shadow': focused()
          ? `0 0 0 3px ${invalid() ? 'color-mix(in srgb, var(--iris-danger) 18%, transparent)' : 'color-mix(in srgb, var(--iris-primary) 18%, transparent)'}`
          : 'none',
        padding: sizeStyles().padding,
        'min-height': sizeStyles().minHeight,
        'font-size': sizeStyles().fontSize,
        ...(local.fullWidth ? { width: '100%' } : null),
        ...(local.width !== undefined ? { width: cssWidth(local.width) } : null),
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
        readOnly={local.readOnly}
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
