import * as React from 'react'
import { RadioGroupContext } from './context'

export type IrisRadioSize = 'sm' | 'md' | 'lg'

const DIM_MAP: Record<IrisRadioSize, string> = {
  sm: '14px',
  md: '18px',
  lg: '22px',
}

export interface IrisRadioProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'value' | 'checked' | 'onChange' | 'defaultChecked'
> {
  value: string
  size?: IrisRadioSize
  children?: React.ReactNode
}

/** Single radio button. Must be used inside an `IrisRadioGroup`. */
export const IrisRadio = React.forwardRef<HTMLInputElement, IrisRadioProps>(function IrisRadio(
  { value, size = 'md', disabled, children, style, ...rest },
  ref,
) {
  const ctx = React.useContext(RadioGroupContext)
  if (!ctx) throw new Error('IrisRadio must be used inside <IrisRadioGroup>')

  const isDisabled = disabled || ctx.disabled
  const isChecked = ctx.value === value

  const handleChange = () => {
    if (isDisabled) return
    ctx.setValue(value)
  }

  const dim = DIM_MAP[size]

  const boxStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: dim,
    height: dim,
    borderRadius: '50%',
    border: `1px solid ${isChecked ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
    background: 'var(--iris-background)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    transition: 'border-color 120ms ease',
    flexShrink: 0,
  }

  const innerDot: React.CSSProperties = {
    width: `calc(${dim} - 8px)`,
    height: `calc(${dim} - 8px)`,
    borderRadius: '50%',
    background: 'var(--iris-primary)',
    transform: isChecked ? 'scale(1)' : 'scale(0)',
    transition: 'transform 120ms ease',
  }

  return (
    <label
      data-iris-radio=""
      data-iris-radio-size={size}
      data-state={isChecked ? 'checked' : 'unchecked'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        ...style,
      }}
    >
      <input
        {...rest}
        ref={ref}
        type="radio"
        name={ctx.name}
        value={value}
        checked={isChecked}
        disabled={isDisabled}
        onChange={handleChange}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
      />
      <span aria-hidden="true" style={boxStyle}>
        <span style={innerDot} />
      </span>
      {children}
    </label>
  )
})
