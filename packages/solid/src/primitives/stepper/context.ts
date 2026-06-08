import { createContext, useContext } from 'solid-js'

export type IrisStepperOrientation = 'horizontal' | 'vertical'
export type IrisStepStatus = 'pending' | 'active' | 'completed' | 'error'

export interface StepperContext {
  current: () => number
  orientation: () => IrisStepperOrientation
  linear: () => boolean
  registerStep: () => number
  unregisterStep: (index: number) => void
  total: () => number
  goTo: (index: number) => void
  computeStatus: (index: number) => IrisStepStatus
}

export const StepperCtx = createContext<StepperContext>()

export function useStepperContext(): StepperContext {
  const ctx = useContext(StepperCtx)
  if (!ctx) throw new Error('IrisStepperStep must be used inside <IrisStepper>')
  return ctx
}
