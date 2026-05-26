import * as React from 'react'
import {
  StepperContext,
  type IrisStepperOrientation,
  type IrisStepStatus,
} from './context'

export interface IrisStepperProps extends Omit<React.HTMLAttributes<HTMLOListElement>, 'onChange'> {
  value?: number
  defaultValue?: number
  onValueChange?: (next: number) => void
  orientation?: IrisStepperOrientation
  /** When true (default), forward navigation is blocked beyond the current step. */
  linear?: boolean
}

/**
 * Multi-step flow container. Children should be `IrisStepperStep`s; each
 * registers itself with the stepper's context and self-renders its indicator
 * + title.
 */
export function IrisStepper({
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  orientation = 'horizontal',
  linear = true,
  style,
  children,
  ...rest
}: IrisStepperProps): React.ReactElement {
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState(defaultValue)
  const [total, setTotal] = React.useState(0)

  const rawValue = isControlled ? (valueProp as number) : internal
  const current = Math.max(0, Math.min(total - 1, rawValue))

  const setValue = React.useCallback(
    (next: number) => {
      if (!isControlled) setInternal(next)
      onValueChange?.(next)
    },
    [isControlled, onValueChange],
  )

  const nextIndexRef = React.useRef(0)
  const registerStep = React.useCallback(() => {
    const index = nextIndexRef.current
    nextIndexRef.current += 1
    setTotal((t) => Math.max(t, index + 1))
    return {
      index,
      unregister: () => {
        // No-op — indices are stable across step lifetimes; total only grows.
      },
    }
  }, [])

  const goTo = React.useCallback(
    (index: number) => {
      if (index < 0 || index >= total) return
      if (linear && index > current) return
      if (index === current) return
      setValue(index)
    },
    [total, linear, current, setValue],
  )

  const computeStatus = React.useCallback(
    (index: number): IrisStepStatus => {
      if (index < current) return 'completed'
      if (index === current) return 'active'
      return 'pending'
    },
    [current],
  )

  const ctx = React.useMemo(
    () => ({
      current,
      total,
      orientation,
      linear,
      registerStep,
      goTo,
      computeStatus,
    }),
    [current, total, orientation, linear, registerStep, goTo, computeStatus],
  )

  return (
    <StepperContext.Provider value={ctx}>
      <ol
        {...rest}
        data-iris-stepper=""
        data-iris-stepper-orientation={orientation}
        role="list"
        style={{
          display: 'flex',
          flexDirection: orientation === 'horizontal' ? 'row' : 'column',
          gap: 0,
          margin: 0,
          padding: 0,
          listStyle: 'none',
          ...style,
        }}
      >
        {children}
      </ol>
    </StepperContext.Provider>
  )
}
