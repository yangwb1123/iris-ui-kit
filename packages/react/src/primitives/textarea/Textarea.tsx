import * as React from 'react'

export type IrisTextareaSize = 'sm' | 'md' | 'lg'

const SIZE_MAP: Record<IrisTextareaSize, { padding: string; fontSize: string }> = {
  sm: {
    padding: 'var(--iris-padding-sm, 6px) var(--iris-space-xs, 8px)',
    fontSize: 'var(--iris-font-size-xs, 12px)',
  },
  md: { padding: '8px 12px', fontSize: 'var(--iris-font-size-md, 14px)' },
  lg: {
    padding: 'var(--iris-space-sm, 12px) var(--iris-padding-md, 12px)',
    fontSize: 'var(--iris-font-size-lg, 16px)',
  },
}

export interface IrisTextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'size'
> {
  size?: IrisTextareaSize
  invalid?: boolean
  ariaDescribedby?: string
  autosize?: boolean
  maxRows?: number
}

/**
 * Multi-line text input with size variants and an `invalid` state. Optionally
 * grows to fit its content when `autosize` is set, capped at `maxRows`.
 *
 * @example
 *   <IrisTextarea value={bio} onChange={(e) => setBio(e.target.value)} autosize maxRows={6} />
 */
export const IrisTextarea = React.forwardRef<HTMLTextAreaElement, IrisTextareaProps>(
  function IrisTextarea(
    {
      size = 'md',
      invalid = false,
      ariaDescribedby,
      autosize = false,
      maxRows = 8,
      rows = 3,
      style,
      onFocus,
      onBlur,
      onChange,
      value,
      defaultValue,
      ...rest
    },
    ref,
  ) {
    const [focused, setFocused] = React.useState(false)
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

    // Combine forwarded ref + internal ref.
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, [])

    const resize = React.useCallback(() => {
      const el = innerRef.current
      if (!el || !autosize) return
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight || '0') || 20
      el.style.height = 'auto'
      const maxPx = maxRows > 0 ? lineHeight * maxRows : Infinity
      el.style.height = `${Math.min(maxPx, el.scrollHeight)}px`
    }, [autosize, maxRows])

    React.useEffect(() => {
      if (autosize) resize()
    }, [autosize, resize, value])

    const sizeStyles = SIZE_MAP[size]

    const borderColor = invalid
      ? 'var(--iris-danger)'
      : focused
        ? 'var(--iris-primary)'
        : 'var(--iris-border)'
    const boxShadow = focused
      ? `0 0 0 3px ${invalid ? 'rgba(239, 68, 68, 0.18)' : 'rgba(99, 102, 241, 0.18)'}`
      : 'none'

    const wrapperStyle: React.CSSProperties = {
      display: 'flex',
      background: 'var(--iris-background)',
      color: 'var(--iris-foreground)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--iris-radius-md, 6px)',
      opacity: rest.disabled ? 0.6 : 1,
      transition: 'border-color 120ms ease, box-shadow 120ms ease',
      boxShadow,
      padding: sizeStyles.padding,
      fontSize: sizeStyles.fontSize,
      lineHeight: 1.5,
      ...style,
    }

    return (
      <div
        data-iris-textarea=""
        data-iris-textarea-size={size}
        data-state={invalid ? 'invalid' : focused ? 'focused' : 'idle'}
        style={wrapperStyle}
      >
        <textarea
          {...rest}
          ref={innerRef}
          rows={rows}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={ariaDescribedby}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'inherit',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            padding: 0,
            resize: 'vertical',
          }}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          onChange={(e) => {
            onChange?.(e)
            if (autosize) resize()
          }}
        />
      </div>
    )
  },
)
