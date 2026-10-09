import * as React from 'react'
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

export interface IrisInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'type' | 'prefix'
> {
  /**
   * Explicit size. Omit to inherit the nearest `<IrisProvider componentSize>`
   * (`md` when there is none).
   */
  size?: IrisInputSize
  type?: IrisInputType
  invalid?: boolean
  /** Forwarded as aria-describedby. */
  ariaDescribedby?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  /** Host box width — any CSS length, or a number of px. */
  width?: string | number
  /** Stretch the host box to its container (`width: 100%`). */
  fullWidth?: boolean
}

/**
 * Single-line text input with size variants, an `invalid` state, and optional
 * `prefix`/`suffix` adornments. Forwards its ref to the native `<input>`.
 *
 * @example
 *   <IrisInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
 */
export const IrisInput = React.forwardRef<HTMLInputElement, IrisInputProps>(function IrisInput(
  {
    size: sizeProp,
    type = 'text',
    invalid = false,
    ariaDescribedby,
    prefix,
    suffix,
    width,
    fullWidth = false,
    style,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = React.useState(false)
  // No explicit `size` → nearest <IrisProvider componentSize>, else `md`.
  const size = useComponentSize(sizeProp)
  const sizeStyles = SIZE_MAP[size]

  const borderColor = invalid
    ? 'var(--iris-danger)'
    : focused
      ? 'var(--iris-primary)'
      : 'var(--iris-border)'
  const boxShadow = focused
    ? `0 0 0 3px ${invalid ? 'color-mix(in srgb, var(--iris-danger) 18%, transparent)' : 'color-mix(in srgb, var(--iris-primary) 18%, transparent)'}`
    : 'none'

  const wrapperStyle: React.CSSProperties = {
    display: 'inline-flex',
    ...(fullWidth || width !== undefined ? { boxSizing: 'border-box' as const } : null),
    alignItems: 'center',
    gap: 'var(--iris-space-xs, 8px)',
    background: rest.readOnly ? 'var(--iris-surface)' : 'var(--iris-background)',
    color: 'var(--iris-foreground)',
    border: `1px solid ${borderColor}`,
    borderRadius: 'var(--iris-radius-md, 6px)',
    cursor: rest.disabled ? 'not-allowed' : rest.readOnly ? 'default' : 'text',
    opacity: rest.disabled ? 0.6 : 1,
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
    boxShadow,
    padding: sizeStyles.padding,
    minHeight: sizeStyles.minHeight,
    fontSize: sizeStyles.fontSize,
    ...(fullWidth ? { width: '100%' } : null),
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : null),
    ...style,
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    padding: 0,
  }

  return (
    <label
      data-iris-input=""
      data-iris-input-size={size}
      data-state={invalid ? 'invalid' : focused ? 'focused' : rest.readOnly ? 'readonly' : 'idle'}
      style={wrapperStyle}
    >
      {prefix ? (
        <span
          data-iris-input-prefix=""
          style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--iris-muted)' }}
        >
          {prefix}
        </span>
      ) : null}
      <input
        {...rest}
        ref={ref}
        type={type}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedby}
        style={inputStyle}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
      />
      {suffix ? (
        <span
          data-iris-input-suffix=""
          style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--iris-muted)' }}
        >
          {suffix}
        </span>
      ) : null}
    </label>
  )
})
