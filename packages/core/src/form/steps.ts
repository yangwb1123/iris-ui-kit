import type { FormValues, FormStep, Key } from './types'
import type { FormStore } from './types'

/**
 * Multi-step (wizard) navigation for the form engine.
 *
 * Steps are ordered lists of field names. `nextStep` validates the
 * current step's fields and advances only when they all pass.
 */
export interface StepNavigation<V extends FormValues> {
  stepCount: () => number
  goToStep: FormStore<V>['goToStep']
  nextStep: FormStore<V>['nextStep']
  prevStep: FormStore<V>['prevStep']
  validateStep: FormStore<V>['validateStep']
}

export function createStepNavigation<V extends FormValues>(
  steps: FormStep<V>[],
  getCurrentStep: () => number,
  setCurrentStep: (index: number) => void,
  validateFields: (names: Key<V>[]) => Promise<(string | undefined)[]>,
  setFieldsTouched: (names: Key<V>[]) => void,
): StepNavigation<V> {
  const count = () => Math.max(1, steps.length)
  const clamp = (i: number) => Math.max(0, Math.min(i, count() - 1))

  const validateStep: FormStore<V>['validateStep'] = async (index) => {
    const step = steps[index ?? getCurrentStep()]
    if (!step) return true
    const results = await validateFields(step.fields)
    setFieldsTouched(step.fields)
    return results.every((e) => e === undefined)
  }

  const goToStep = (index: number) => setCurrentStep(clamp(index))

  const nextStep = async () => {
    const ok = await validateStep()
    if (!ok) return false
    const cur = getCurrentStep()
    if (cur >= count() - 1) return false
    setCurrentStep(clamp(cur + 1))
    return true
  }

  const prevStep = () => setCurrentStep(clamp(getCurrentStep() - 1))

  return { stepCount: count, goToStep, nextStep, prevStep, validateStep }
}
