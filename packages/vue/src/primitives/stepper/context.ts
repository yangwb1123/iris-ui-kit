import type { ComputedRef, InjectionKey } from 'vue'

export type IrisStepperOrientation = 'horizontal' | 'vertical'
export type IrisStepStatus = 'pending' | 'active' | 'completed' | 'error'

export interface StepperContext {
  /** Active step index (0-based). */
  current: ComputedRef<number>
  orientation: ComputedRef<IrisStepperOrientation>
  linear: ComputedRef<boolean>
  /** Register a step and get back its assigned index. */
  registerStep: () => number
  unregisterStep: (index: number) => void
  /** Total number of registered steps. */
  total: ComputedRef<number>
  /** Move to the given step (no-op if blocked by linear / out of range). */
  goTo: (index: number) => void
  /** Auto-status given a step's index (caller may override with prop). */
  computeStatus: (index: number) => IrisStepStatus
}

export const StepperContextKey: InjectionKey<StepperContext> = Symbol('IrisStepper')
