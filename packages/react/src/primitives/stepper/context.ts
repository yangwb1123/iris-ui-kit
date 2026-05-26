import * as React from 'react'

export type IrisStepperOrientation = 'horizontal' | 'vertical'
export type IrisStepStatus = 'pending' | 'active' | 'completed' | 'error'

export interface StepperContextValue {
  current: number
  total: number
  orientation: IrisStepperOrientation
  linear: boolean
  /** Register a step at mount. Returns the assigned index and an unregister fn. */
  registerStep: () => { index: number; unregister: () => void }
  goTo: (index: number) => void
  computeStatus: (index: number) => IrisStepStatus
}

export const StepperContext = React.createContext<StepperContextValue | null>(null)

export function useStepperContext(componentName: string): StepperContextValue {
  const ctx = React.useContext(StepperContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be inside an <IrisStepper>`)
  }
  return ctx
}
