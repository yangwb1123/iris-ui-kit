import { getContext, setContext } from 'svelte'

/** Context key for the form-field wiring — a module-singleton Symbol. */
export const FORM_FIELD_KEY = Symbol('iris-ui:form-field')

/**
 * Svelte's answer to React's cloneElement injection: `IrisFormField` publishes
 * `{ id, describedBy, invalid }` (as reactive getters) and field controls
 * (`IrisInput`, `IrisSwitch`) self-wire by reading `useFormFieldControl()`,
 * falling back to their own props when rendered standalone.
 */
export interface FormFieldControl {
  readonly id: string
  readonly describedBy: string | undefined
  readonly invalid: boolean
}

export function setFormFieldContext(value: FormFieldControl): void {
  setContext(FORM_FIELD_KEY, value)
}

export function useFormFieldControl(): FormFieldControl | undefined {
  return getContext<FormFieldControl | undefined>(FORM_FIELD_KEY)
}
