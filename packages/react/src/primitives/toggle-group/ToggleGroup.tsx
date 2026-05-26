import * as React from 'react'
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
  const initialUncontrolled: IrisToggleGroupValue =
    defaultValue !== undefined ? defaultValue : isMultiple ? [] : null
  const [internal, setInternal] = React.useState<IrisToggleGroupValue>(initialUncontrolled)

  const current = isControlled ? (valueProp as IrisToggleGroupValue) : internal

  const isActive = React.useCallback(
    (v: string): boolean => {
      if (current === null || current === undefined) return false
      if (Array.isArray(current)) return current.includes(v)
      return current === v
    },
    [current],
  )

  const controlledRef = React.useRef(valueProp)
  controlledRef.current = valueProp

  const toggle = React.useCallback(
    (v: string) => {
      if (disabled) return
      const compute = (prev: IrisToggleGroupValue): IrisToggleGroupValue => {
        if (isMultiple) {
          const arr = Array.isArray(prev) ? prev : []
          const idx = arr.indexOf(v)
          return idx >= 0 ? arr.filter((x) => x !== v) : [...arr, v]
        }
        return prev === v ? null : v
      }
      if (isControlled) {
        const next = compute(controlledRef.current as IrisToggleGroupValue)
        ;(onValueChange as ((next: IrisToggleGroupValue) => void) | undefined)?.(next)
        return
      }
      setInternal((prev) => {
        const next = compute(prev)
        if (next !== prev) {
          ;(onValueChange as ((next: IrisToggleGroupValue) => void) | undefined)?.(next)
        }
        return next
      })
    },
    [disabled, isMultiple, isControlled, onValueChange],
  )

  // Registry kept in a ref; reads happen at event time.
  const itemsRef = React.useRef<RegisteredItem[]>([])
  const registerItem = React.useCallback(
    (value: string, el: { current: HTMLElement | null }) => {
      if (!itemsRef.current.find((it) => it.value === value)) {
        itemsRef.current = [...itemsRef.current, { value, el }]
      }
      return () => {
        itemsRef.current = itemsRef.current.filter((it) => it.value !== value)
      }
    },
    [],
  )

  const moveFocus = React.useCallback(
    (from: string, delta: 1 | -1 | 'home' | 'end') => {
      const items = itemsRef.current
      if (items.length === 0) return
      const idx = items.findIndex((it) => it.value === from)
      let nextIdx: number
      if (delta === 'home') nextIdx = 0
      else if (delta === 'end') nextIdx = items.length - 1
      else nextIdx = (idx + delta + items.length) % items.length
      items[nextIdx]?.el.current?.focus()
    },
    [],
  )

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
          border:
            variant === 'outline' ? '1px solid var(--iris-border)' : '1px solid transparent',
          ...style,
        }}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  )
}
