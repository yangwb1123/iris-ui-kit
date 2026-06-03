import { createSignal, mergeProps, splitProps, type JSX } from 'solid-js'
import { useFormFieldControl } from '../form-field/context'

export type IrisSwitchSize = 'sm' | 'md' | 'lg'

const DIM_MAP: Record<IrisSwitchSize, { width: string; height: string; thumb: string }> = {
  sm: { width: '28px', height: '16px', thumb: '12px' },
  md: { width: '36px', height: '20px', thumb: '16px' },
  lg: { width: '44px', height: '24px', thumb: '20px' },
}

export interface IrisSwitchProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'value' | 'checked' | 'onChange'
> {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (next: boolean, event: Event) => void
  size?: IrisSwitchSize
  invalid?: boolean
  ariaDescribedby?: string
}

/** Solid port of the React/Vue IrisSwitch. Self-wires aria from IrisFormField. */
export function IrisSwitch(props: IrisSwitchProps): JSX.Element {
  const field = useFormFieldControl()
  const merged = mergeProps(
    { size: 'md' as IrisSwitchSize, disabled: false, invalid: false },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'checked',
    'defaultChecked',
    'onChange',
    'size',
    'disabled',
    'invalid',
    'ariaDescribedby',
    'style',
    'id',
  ])

  const [internal, setInternal] = createSignal(Boolean(local.defaultChecked))
  const isControlled = (): boolean => local.checked !== undefined
  const value = (): boolean => (isControlled() ? Boolean(local.checked) : internal())

  const handleChange = (e: Event & { currentTarget: HTMLInputElement }): void => {
    if (local.disabled) return
    const next = e.currentTarget.checked
    if (!isControlled()) setInternal(next)
    local.onChange?.(next, e)
  }

  const invalid = (): boolean => local.invalid || (field?.invalid() ?? false)
  const describedBy = (): string | undefined => local.ariaDescribedby ?? field?.describedBy()
  const dim = (): { width: string; height: string; thumb: string } => DIM_MAP[local.size]
  const thumbOffset = (): string =>
    value() ? `calc(${dim().width} - ${dim().thumb} - 2px)` : '2px'

  return (
    <label
      data-iris-switch=""
      data-iris-switch-size={local.size}
      data-state={value() ? 'checked' : 'unchecked'}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        gap: '8px',
        cursor: local.disabled ? 'not-allowed' : 'pointer',
        'user-select': 'none',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <input
        {...rest}
        id={local.id ?? field?.id()}
        type="checkbox"
        role="switch"
        checked={value()}
        disabled={local.disabled}
        aria-checked={value() ? 'true' : 'false'}
        aria-describedby={describedBy()}
        aria-invalid={invalid() ? 'true' : undefined}
        onChange={handleChange}
        style={{
          position: 'absolute',
          opacity: 0,
          width: '0',
          height: '0',
          'pointer-events': 'none',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          display: 'inline-block',
          width: dim().width,
          height: dim().height,
          background: value() ? 'var(--iris-primary)' : 'var(--iris-border)',
          'border-radius': '999px',
          transition: 'background-color 120ms ease',
          cursor: local.disabled ? 'not-allowed' : 'pointer',
          opacity: local.disabled ? 0.6 : 1,
          'vertical-align': 'middle',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            left: thumbOffset(),
            width: dim().thumb,
            height: dim().thumb,
            background: 'var(--iris-background)',
            'border-radius': '999px',
            transition: 'left 140ms ease',
            'box-shadow': '0 1px 3px rgba(0,0,0,0.18)',
          }}
        />
      </span>
    </label>
  )
}
