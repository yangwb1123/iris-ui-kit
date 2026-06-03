import { createContext, useContext, type Accessor } from 'solid-js'

export interface FormFieldControl {
  id: Accessor<string>
  describedBy: Accessor<string | undefined>
  invalid: Accessor<boolean>
}

export const FormFieldContext = createContext<FormFieldControl>()

/**
 * Optional read of the enclosing `IrisFormField`'s wiring — Solid's answer to
 * React's cloneElement injection. Field controls (`IrisInput`, `IrisSwitch`, …)
 * call this to self-wire `id` / `aria-describedby` / `invalid`, falling back to
 * their own props when rendered standalone.
 */
export function useFormFieldControl(): FormFieldControl | undefined {
  return useContext(FormFieldContext)
}
