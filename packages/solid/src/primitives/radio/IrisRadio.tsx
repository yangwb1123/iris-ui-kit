import { createSignal, createUniqueId, mergeProps, splitProps, type JSX } from 'solid-js'
import { RadioGroupCtx, useRadioGroupContext, type IrisRadioSize } from './context'

// ── Group ──────────────────────────────────────────────────────────────────

export interface IrisRadioGroupProps {
  value?: string | number | boolean | null
  defaultValue?: string | number | boolean | null
  name?: string
  size?: IrisRadioSize
  disabled?: boolean
  onChange?: (value: string | number | boolean) => void
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

export function IrisRadioGroup(props: IrisRadioGroupProps): JSX.Element {
  const merged = mergeProps(
    { size: 'md' as IrisRadioSize, disabled: false, defaultValue: null },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'name',
    'size',
    'disabled',
    'onChange',
    'children',
  ])

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal<string | number | boolean | null>(
    local.defaultValue ?? null,
  )
  const currentValue = (): string | number | boolean | null =>
    isControlled() ? (local.value ?? null) : internal()

  const fallbackName = createUniqueId()
  const groupName = local.name ?? fallbackName

  const setValue = (v: string | number | boolean): void => {
    if (!isControlled()) setInternal(v)
    local.onChange?.(v)
  }

  return (
    <RadioGroupCtx.Provider
      value={{
        name: groupName,
        value: currentValue,
        setValue,
        get size() {
          return () => local.size
        },
        get disabled() {
          return () => local.disabled
        },
      }}
    >
      <div
        {...rest}
        role="radiogroup"
        data-iris-radio-group=""
        style={{
          display: 'inline-flex',
          'flex-direction': 'column',
          gap: 'var(--iris-gap-sm, 6px)',
        }}
      >
        {local.children}
      </div>
    </RadioGroupCtx.Provider>
  )
}

// ── Radio ──────────────────────────────────────────────────────────────────

export interface IrisRadioProps {
  value: string | number | boolean
  /** Standalone mode only */
  checked?: string | number | boolean | null
  size?: IrisRadioSize
  disabled?: boolean
  id?: string
  onChange?: (value: string | number | boolean) => void
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
}

export function IrisRadio(props: IrisRadioProps): JSX.Element {
  const merged = mergeProps({ disabled: false }, props)
  const [local] = splitProps(merged, [
    'value',
    'checked',
    'size',
    'disabled',
    'id',
    'onChange',
    'children',
    'style',
    'class',
  ])

  const group = useRadioGroupContext()

  const size = (): IrisRadioSize => local.size ?? group?.size() ?? 'md'
  const disabled = (): boolean => local.disabled || (group?.disabled() ?? false)

  const isChecked = (): boolean => {
    if (group) return group.value() === local.value
    return local.checked === local.value
  }

  const dim = (): string => {
    const map: Record<IrisRadioSize, string> = { sm: '14px', md: '18px', lg: '22px' }
    return map[size()]
  }

  const handleChange = (): void => {
    if (disabled()) return
    if (group) group.setValue(local.value)
    else local.onChange?.(local.value)
  }

  return (
    <label
      data-iris-radio=""
      data-iris-radio-size={size()}
      data-state={isChecked() ? 'checked' : 'unchecked'}
      class={local.class as string | undefined}
      style={{
        display: 'inline-flex',
        'align-items': 'center',
        gap: 'var(--iris-gap-sm, 6px)',
        cursor: disabled() ? 'not-allowed' : 'pointer',
        'user-select': 'none',
        ...((local.style as JSX.CSSProperties) ?? {}),
      }}
    >
      <input
        type="radio"
        id={local.id}
        name={group?.name}
        value={String(local.value)}
        checked={isChecked()}
        disabled={disabled()}
        style={{
          position: 'absolute',
          opacity: 0,
          width: '0',
          height: '0',
          'pointer-events': 'none',
        }}
        onChange={handleChange}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          display: 'inline-flex',
          'align-items': 'center',
          'justify-content': 'center',
          width: dim(),
          height: dim(),
          'border-radius': '999px',
          border: `1px solid ${isChecked() ? 'var(--iris-primary)' : 'var(--iris-border)'}`,
          background: 'var(--iris-background)',
          cursor: disabled() ? 'not-allowed' : 'pointer',
          opacity: disabled() ? 0.6 : 1,
          transition: 'border-color 120ms ease',
          'flex-shrink': '0',
        }}
      >
        <span
          style={{
            width: '50%',
            height: '50%',
            'border-radius': '999px',
            background: 'var(--iris-primary)',
            transform: isChecked() ? 'scale(1)' : 'scale(0)',
            transition: 'transform 140ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </span>
      {local.children && <span>{local.children}</span>}
    </label>
  )
}
