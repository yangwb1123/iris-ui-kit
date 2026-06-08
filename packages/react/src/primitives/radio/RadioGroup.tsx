import * as React from 'react'
import { createSelectionModel, type SelectionModel } from '@iris-ui/core'
import { useStore } from '../../useStore'
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
  // Single-selection logic (controlled/uncontrolled) lives in the core model;
  // this group only maps its `string | null` value ⇄ the model's flat key
  // array. A radio never toggles off, so `setValue` uses `model.set`.
  const isControlled = value !== undefined
  const toKeys = (v: string | null | undefined): string[] => (v == null ? [] : [v])
  const modelRef = React.useRef<SelectionModel<string> | null>(null)
  if (modelRef.current === null) {
    modelRef.current = createSelectionModel<string>({
      mode: 'single',
      defaultSelected: toKeys(isControlled ? value : defaultValue),
      onChange: (keys) => onChange?.(keys[0] ?? ''),
    })
  }
  const model = modelRef.current
  const current = useStore(model.store)[0] ?? null

  // Controlled: mirror the prop into the model without re-emitting onChange.
  React.useEffect(() => {
    if (isControlled) model.sync(toKeys(value))
  }, [value, isControlled, model])

  const groupName = React.useMemo(() => name ?? generateGroupName(), [name])

  const setValue = (next: string) => {
    if (disabled) return
    model.set([next])
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
