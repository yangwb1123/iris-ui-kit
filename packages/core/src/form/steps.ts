import type { FormValues, FormStep, Key } from './types'
import type { FormStore } from './types'

/**
 * Multi-step (wizard) navigation for the form engine.
 *
 * Steps are ordered lists of field names. `nextStep` validates the
 * current step's fields and advances only when they all pass.
 *
 * @remarks
 * This is the same navigation logic used internally by `createFormStore`.
 * When you configure a form with `steps`, the store delegates to this.
 * Use it directly when building a **custom multi-step flow** that doesn't
 * use Iris's form store (e.g., a wizard UI with separate validation per
 * step but no unified form state).
 *
 * @see createStepNavigation
 */
export interface StepNavigation<V extends FormValues> {
  stepCount: () => number
  goToStep: FormStore<V>['goToStep']
  nextStep: FormStore<V>['nextStep']
  prevStep: FormStore<V>['prevStep']
  validateStep: FormStore<V>['validateStep']
}

/**
 * Create a multi-step (wizard) navigation controller.
 *
 * This is the **same navigation** used internally by `createFormStore` when
 * you configure it with `steps`. Use it directly when you need step-based
 * navigation outside a form store — e.g., a multi-page setup wizard that
 * validates each page's fields before advancing.
 *
 * @param steps - Ordered list of form steps, each with a `fields` array.
 * @param getCurrentStep - Read the current step index (0-based).
 * @param setCurrentStep - Set the current step index (clamped to [0, stepCount-1]).
 * @param validateFields - Validate a set of field names, returning per-field errors.
 * @param setFieldsTouched - Mark fields as touched (called after validation attempt).
 *
 * @example
 * ```ts
 * const nav = createStepNavigation(
 *   [
 *     { id: 'personal', fields: ['name', 'email'] },
 *     { id: 'address', fields: ['street', 'city'] },
 *   ],
 *   () => currentStep,
 *   (i) => { currentStep = i },
 *   async (names) => Promise.all(names.map(n => runValidator(n))),
 *   (names) => markTouched(names),
 * )
 *
 * const ok = await nav.nextStep()
 * if (!ok) { /* validation failed, stay on current step *\/ }
 * ```
 */
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
