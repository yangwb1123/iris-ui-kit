import * as React from 'react'

export type IrisSwitchSize = 'sm' | 'md' | 'lg'

const DIM_MAP: Record<IrisSwitchSize, { width: string; height: string; thumb: string }> = {
  sm: { width: '28px', height: '16px', thumb: '12px' },
  md: { width: '36px', height: '20px', thumb: '16px' },
  lg: { width: '44px', height: '24px', thumb: '20px' },
}

export interface IrisSwitchProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'value' | 'checked' | 'onChange'
> {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (next: boolean, event: React.ChangeEvent<HTMLInputElement>) => void
  size?: IrisSwitchSize
  invalid?: boolean
  ariaDescribedby?: string
}

/**
 * Toggle switch for an on/off boolean, in controlled (`checked`) or
 * uncontrolled (`defaultChecked`) modes. Rendered with `role="switch"`.
 *
 * @example
 *   <IrisSwitch checked={enabled} onChange={(next) => setEnabled(next)} />
 */
export const IrisSwitch = React.forwardRef<HTMLInputElement, IrisSwitchProps>(function IrisSwitch(
  {
    checked,
    defaultChecked,
    onChange,
    size = 'md',
    disabled = false,
    invalid = false,
    ariaDescribedby,
    style,
    ...rest
  },
  ref,
) {
  const [internalChecked, setInternalChecked] = React.useState(Boolean(defaultChecked))
  const isControlled = checked !== undefined
  const value = isControlled ? Boolean(checked) : internalChecked

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const next = e.target.checked
    if (!isControlled) setInternalChecked(next)
    onChange?.(next, e)
  }

  const dim = DIM_MAP[size]

  const trackStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    width: dim.width,
    height: dim.height,
    background: value ? 'var(--iris-primary)' : 'var(--iris-border)',
    borderRadius: 999,
    transition: 'background-color 120ms ease',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    verticalAlign: 'middle',
  }
  const thumbOffset = value ? `calc(${dim.width} - ${dim.thumb} - 2px)` : '2px'

  const thumbStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: thumbOffset,
    width: dim.thumb,
    height: dim.thumb,
    background: 'var(--iris-background)',
    borderRadius: 999,
    transition: 'left 140ms ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
  }

  return (
    <label
      data-iris-switch=""
      data-iris-switch-size={size}
      data-state={value ? 'checked' : 'unchecked'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        ...style,
      }}
    >
      <input
        {...rest}
        ref={ref}
        type="checkbox"
        role="switch"
        checked={value}
        disabled={disabled}
        aria-checked={value ? 'true' : 'false'}
        aria-describedby={ariaDescribedby}
        aria-invalid={invalid ? 'true' : undefined}
        onChange={handleChange}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
      />
      <span aria-hidden="true" style={trackStyle}>
        <span style={thumbStyle} />
      </span>
    </label>
  )
})
