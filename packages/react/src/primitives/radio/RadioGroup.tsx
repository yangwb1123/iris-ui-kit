import * as React from 'react'
import { RadioGroupContext } from './context'

let __counter = 0
function generateGroupName(): string {
  __counter += 1
  return `iris-radio-${__counter}`
}

export interface IrisRadioGroupProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Group name. Auto-generated if omitted. */
  name?: string
  value?: string | null
  defaultValue?: string | null
  onChange?: (next: string) => void
  disabled?: boolean
  orientation?: 'horizontal' | 'vertical'
  children?: React.ReactNode
}

/** React port of {@link import('@iris-ui/vue').IrisRadioGroup}. */
export function IrisRadioGroup({
  name,
  value,
  defaultValue,
  onChange,
  disabled = false,
  orientation = 'vertical',
  style,
  children,
  ...rest
}: IrisRadioGroupProps): React.ReactElement {
  const [internal, setInternal] = React.useState<string | null>(defaultValue ?? null)
  const isControlled = value !== undefined
  const current = isControlled ? (value as string | null) : internal

  const groupName = React.useMemo(() => name ?? generateGroupName(), [name])

  const setValue = (next: string) => {
    if (disabled) return
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  return (
    <RadioGroupContext.Provider value={{ name: groupName, value: current, setValue, disabled }}>
      <div
        {...rest}
        role="radiogroup"
        aria-disabled={disabled ? 'true' : undefined}
        data-iris-radio-group=""
        data-iris-radio-group-orientation={orientation}
        style={{
          display: 'flex',
          flexDirection: orientation === 'horizontal' ? 'row' : 'column',
          gap: 8,
          ...style,
        }}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}
