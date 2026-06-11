import * as React from 'react'
import { createSelectionModel, type SelectionModel } from '@iris-ui/core'
import { useStore } from '../../useStore'
import {
  ToggleGroupContext,
  type IrisToggleGroupOrientation,
  type IrisToggleGroupSize,
  type IrisToggleGroupType,
  type IrisToggleGroupVariant,
} from './context'

export type IrisToggleGroupValue = string | string[] | null

export interface IrisToggleGroupSingleProps {
  type?: 'single'
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (next: string | null) => void
}
export interface IrisToggleGroupMultipleProps {
  type: 'multiple'
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (next: string[]) => void
}

export type IrisToggleGroupProps = (IrisToggleGroupSingleProps | IrisToggleGroupMultipleProps) &
  Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | 'type'> & {
    orientation?: IrisToggleGroupOrientation
    size?: IrisToggleGroupSize
    variant?: IrisToggleGroupVariant
    disabled?: boolean
  }

interface RegisteredItem {
  value: string
  el: { current: HTMLElement | null }
}

/**
 * Segmented control. Two modes:
 *   - `type="single"` — radio-like; value is `string | null`. Root gets
 *     `role="radiogroup"`, items get `role="radio"` + `aria-checked`.
 *   - `type="multiple"` — toggle-like; value is `string[]`. Root gets
 *     `role="group"`, items get `aria-pressed`.
 */
export function IrisToggleGroup(props: IrisToggleGroupProps): React.ReactElement {
  const {
    type = 'single',
    orientation = 'horizontal',
    size = 'md',
    variant = 'outline',
    disabled = false,
    value: valueProp,
    defaultValue,
    onValueChange,
    style,
    children,
    ...rest
  } = props as IrisToggleGroupProps & {
    type?: IrisToggleGroupType
    value?: IrisToggleGroupValue
    defaultValue?: IrisToggleGroupValue
    onValueChange?: (next: IrisToggleGroupValue) => void
  }

  const isMultiple = type === 'multiple'
  const isControlled = valueProp !== undefined

  // Selection logic (single/multiple toggle, dedup) lives in the core model;
  // this component only maps its union value shape (string | string[] | null)
  // to/from the model's flat key array.
  const toKeys = (v: IrisToggleGroupValue): string[] =>
    v == null ? [] : Array.isArray(v) ? v : [v]
  const fromKeys = (keys: string[]): IrisToggleGroupValue => (isMultiple ? keys : (keys[0] ?? null))

  const modelRef = React.useRef<SelectionModel<string> | null>(null)
  if (modelRef.current === null) {
    const initial: IrisToggleGroupValue =
      defaultValue !== undefined ? defaultValue : isMultiple ? [] : null
    modelRef.current = createSelectionModel<string>({
      mode: isMultiple ? 'multiple' : 'single',
      defaultSelected: toKeys(valueProp !== undefined ? valueProp : initial),
      onChange: (keys) =>
        (onValueChange as ((next: IrisToggleGroupValue) => void) | undefined)?.(fromKeys(keys)),
    })
  }
  const model = modelRef.current
  const selected = useStore(model.store)

  // Controlled: mirror the prop into the model without re-emitting onChange.
  React.useEffect(() => {
    if (isControlled) model.sync(toKeys(valueProp))
  }, [valueProp, isControlled, model])

  // Controlled groups RENDER from the prop (true controlled semantics): a press
  // emits onChange but the active items only change when the parent writes
  // `value` back; uncontrolled renders from the model store.
  const displaySelected = isControlled ? toKeys(valueProp) : selected

  const isActive = React.useCallback(
    (v: string): boolean => displaySelected.includes(v),
    [displaySelected],
  )

  const toggle = React.useCallback(
    (v: string) => {
      if (disabled) return
      // Re-base on the prop so the emitted next value is computed against what
      // the parent holds (not a prior, possibly-rejected, optimistic value).
      if (isControlled) model.sync(toKeys(valueProp))
      model.toggle(v)
    },
    [disabled, model, isControlled, valueProp],
  )

  // Registry kept in a ref; reads happen at event time.
  const itemsRef = React.useRef<RegisteredItem[]>([])
  const registerItem = React.useCallback((value: string, el: { current: HTMLElement | null }) => {
    if (!itemsRef.current.find((it) => it.value === value)) {
      itemsRef.current = [...itemsRef.current, { value, el }]
    }
    return () => {
      itemsRef.current = itemsRef.current.filter((it) => it.value !== value)
    }
  }, [])

  const moveFocus = React.useCallback((from: string, delta: 1 | -1 | 'home' | 'end') => {
    const items = itemsRef.current
    if (items.length === 0) return
    const idx = items.findIndex((it) => it.value === from)
    let nextIdx: number
    if (delta === 'home') nextIdx = 0
    else if (delta === 'end') nextIdx = items.length - 1
    else nextIdx = (idx + delta + items.length) % items.length
    items[nextIdx]?.el.current?.focus()
  }, [])

  const ctx = React.useMemo(
    () => ({
      type: type as IrisToggleGroupType,
      orientation,
      size,
      variant,
      disabled,
      isActive,
      toggle,
      registerItem,
      moveFocus,
    }),
    [type, orientation, size, variant, disabled, isActive, toggle, registerItem, moveFocus],
  )

  return (
    <ToggleGroupContext.Provider value={ctx}>
      <div
        {...rest}
        role={isMultiple ? 'group' : 'radiogroup'}
        aria-orientation={orientation}
        aria-disabled={disabled ? 'true' : undefined}
        data-iris-toggle-group=""
        data-iris-toggle-group-type={type}
        data-iris-toggle-group-orientation={orientation}
        data-iris-toggle-group-size={size}
        style={{
          display: 'inline-flex',
          flexDirection: orientation === 'horizontal' ? 'row' : 'column',
          borderRadius: 'var(--iris-radius-md, 6px)',
          overflow: 'hidden',
          background: variant === 'outline' ? 'transparent' : 'var(--iris-surface)',
          border: variant === 'outline' ? '1px solid var(--iris-border)' : '1px solid transparent',
          ...style,
        }}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  )
}
