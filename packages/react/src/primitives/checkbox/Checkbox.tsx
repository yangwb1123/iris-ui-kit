import * as React from 'react'

export type IrisCheckboxSize = 'sm' | 'md' | 'lg'
export type IrisCheckboxValue = boolean | 'indeterminate'

const DIM_MAP: Record<IrisCheckboxSize, string> = {
  sm: '14px',
  md: '18px',
  lg: '22px',
}

export interface IrisCheckboxProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'size' | 'value' | 'checked' | 'defaultChecked' | 'onChange'
  > {
  /** `true`, `false`, or `'indeterminate'`. */
  checked?: IrisCheckboxValue
  defaultChecked?: IrisCheckboxValue
  onChange?: (next: boolean, event: React.ChangeEvent<HTMLInputElement>) => void
  size?: IrisCheckboxSize
  invalid?: boolean
  ariaDescribedby?: string
  /** Label content rendered next to the box. */
  children?: React.ReactNode
}

export const IrisCheckbox = React.forwardRef<HTMLInputElement, IrisCheckboxProps>(function IrisCheckbox(
  {
    checked,
    defaultChecked = false,
    onChange,
    size = 'md',
    disabled = false,
    invalid = false,
    ariaDescribedby,
    children,
    style,
    ...rest
  },
  ref,
) {
  const [internalChecked, setInternalChecked] = React.useState<IrisCheckboxValue>(defaultChecked)
  const isControlled = checked !== undefined
  const value: IrisCheckboxValue = isControlled ? (checked as IrisCheckboxValue) : internalChecked

  const innerRef = React.useRef<HTMLInputElement | null>(null)
  React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, [])

  // Sync `indeterminate` (it's a DOM-only attribute, not a JSX prop).
  React.useEffect(() => {
    const el = innerRef.current
    if (el) el.indeterminate = value === 'indeterminate'
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const next = e.target.checked
    if (!isControlled) setInternalChecked(next)
    onChange?.(next, e)
  }

  const state: 'checked' | 'unchecked' | 'indeterminate' =
    value === 'indeterminate' ? 'indeterminate' : value ? 'checked' : 'unchecked'

  const dim = DIM_MAP[size]

  const boxStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: dim,
    height: dim,
    borderRadius: 'var(--iris-radius-sm, 4px)',
    border: `1px solid ${state === 'unchecked' ? 'var(--iris-border)' : 'var(--iris-primary)'}`,
    background:
      state === 'unchecked' ? 'var(--iris-background)' : 'var(--iris-primary)',
    color: 'var(--iris-primary-foreground, #fff)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'background-color 120ms ease, border-color 120ms ease',
    flexShrink: 0,
  }

  const indicator =
    state === 'checked' ? '✓' : state === 'indeterminate' ? '—' : null

  return (
    <label
      data-iris-checkbox=""
      data-iris-checkbox-size={size}
      data-state={state}
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
        ref={innerRef}
        type="checkbox"
        checked={value === true}
        disabled={disabled}
        aria-checked={state === 'indeterminate' ? 'mixed' : state === 'checked' ? 'true' : 'false'}
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
      <span aria-hidden="true" style={boxStyle}>
        {indicator}
      </span>
      {children}
    </label>
  )
})
