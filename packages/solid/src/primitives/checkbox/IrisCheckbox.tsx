import { createSignal, mergeProps, splitProps, type JSX } from 'solid-js'
import type { Size } from '@iris-ui/core'
import { useFormFieldControl } from '../form-field/context'

export type IrisCheckboxSize = Size
export type IrisCheckboxValue = boolean | 'indeterminate'

const DIM_MAP: Record<IrisCheckboxSize, string> = { sm: '14px', md: '18px', lg: '22px' }

export interface IrisCheckboxProps {
  checked?: IrisCheckboxValue
  defaultChecked?: IrisCheckboxValue
  onChange?: (value: boolean) => void
  size?: IrisCheckboxSize
  disabled?: boolean
  id?: string
  name?: string
  value?: string | number
  ariaDescribedby?: string
  ariaLabel?: string
  invalid?: boolean
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

/**
 * Tri-state checkbox: `false` (unchecked), `true` (checked), or
 * `'indeterminate'`. Solid port of the Vue/React IrisCheckbox.
 */
export function IrisCheckbox(props: IrisCheckboxProps): JSX.Element {
  const field = useFormFieldControl()
  const merged = mergeProps(
    {
      size: 'md' as IrisCheckboxSize,
      disabled: false,
      invalid: false,
      defaultChecked: false as IrisCheckboxValue,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'checked',
    'defaultChecked',
    'onChange',
    'size',
    'disabled',
    'id',
    'name',
    'value',
    'ariaDescribedby',
    'ariaLabel',
    'invalid',
    'children',
    'style',
    'class',
  ])

  const isControlled = (): boolean => local.checked !== undefined
  const [internal, setInternal] = createSignal<IrisCheckboxValue>(local.defaultChecked ?? false)
  const current = (): IrisCheckboxValue =>
    isControlled() ? (local.checked as IrisCheckboxValue) : internal()

  const state = (): 'checked' | 'unchecked' | 'indeterminate' => {
    const v = current()
    if (v === 'indeterminate') return 'indeterminate'
    return v ? 'checked' : 'unchecked'
  }

  const dim = (): string => DIM_MAP[local.size]

  const handleChange = (e: Event & { currentTarget: HTMLInputElement }): void => {
    if (local.disabled) return
    const next = e.currentTarget.checked
    if (!isControlled()) setInternal(next)
    local.onChange?.(next)
  }

  const invalid = (): boolean => local.invalid || (field?.invalid() ?? false)
  const describedBy = (): string | undefined => local.ariaDescribedby ?? field?.describedBy()
  const inputId = (): string | undefined => local.id ?? field?.id()

  const boxStyle = (): JSX.CSSProperties => ({
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: dim(),
    height: dim(),
    'border-radius': 'var(--iris-radius-sm)',
    border: `1px solid ${state() === 'unchecked' ? 'var(--iris-border)' : 'var(--iris-primary)'}`,
    background: state() === 'unchecked' ? 'var(--iris-background)' : 'var(--iris-primary)',
    color: 'var(--iris-primary-foreground)',
    cursor: local.disabled ? 'not-allowed' : 'pointer',
    opacity: local.disabled ? 0.6 : 1,
    transition: 'background-color 120ms ease, border-color 120ms ease',
    'vertical-align': 'middle',
    'flex-shrink': '0',
  })

  return (
    <label
      data-iris-checkbox=""
      data-iris-checkbox-size={local.size}
      data-state={state()}
      class={local.class}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        gap: 'var(--iris-gap-sm, 6px)',
        cursor: local.disabled ? 'not-allowed' : 'pointer',
        'user-select': 'none',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <input
        type="checkbox"
        id={inputId()}
        name={local.name}
        value={local.value !== undefined ? String(local.value) : undefined}
        checked={current() === true}
        disabled={local.disabled}
        aria-checked={
          state() === 'indeterminate' ? 'mixed' : state() === 'checked' ? 'true' : 'false'
        }
        aria-describedby={describedBy()}
        aria-label={local.ariaLabel}
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
      <span aria-hidden="true" style={boxStyle()}>
        {state() === 'indeterminate' ? (
          <span
            style={{
              width: '60%',
              height: '2px',
              background: 'currentColor',
              'border-radius': '1px',
            }}
          />
        ) : state() === 'checked' ? (
          <svg aria-hidden="true" viewBox="0 0 16 16" width="80%" height="80%" fill="none">
            <path
              d="M3 8.5 L6.5 12 L13 4.5"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        ) : null}
      </span>
      {local.children && <span>{local.children}</span>}
    </label>
  )
}
