import { getContext, setContext } from 'svelte'

export const STEPPER_KEY = Symbol('iris-ui:stepper')

export type IrisStepStatus = 'pending' | 'active' | 'completed' | 'error'
export type IrisStepperOrientation = 'horizontal' | 'vertical'

export interface StepperContextValue {
  readonly current: number
  readonly total: number
  readonly orientation: IrisStepperOrientation
  readonly linear: boolean
  registerStep: () => number
  unregisterStep: () => void
  goTo: (index: number) => void
  computeStatus: (index: number) => IrisStepStatus
}

export function setStepperContext(value: StepperContextValue): void {
  setContext(STEPPER_KEY, value)
}

export function getStepperContext(componentName: string): StepperContextValue {
  const ctx = getContext<StepperContextValue | undefined>(STEPPER_KEY)
  if (!ctx) throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisStepper>`)
  return ctx
}
