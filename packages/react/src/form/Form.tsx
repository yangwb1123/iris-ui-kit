import * as React from 'react'
import type { FormStore, FormValues } from '@iris-ui/core'
import { FormContext } from './context'

/** Focus (and best-effort scroll to) the first errored named control in DOM order. */
function focusFirstError(
  formEl: HTMLFormElement | null,
  errors: Record<string, string | undefined>,
): void {
  if (!formEl) return
  const keys = Object.keys(errors)
  if (keys.length === 0) return
  const controls = formEl.querySelectorAll<HTMLElement>(
    'input[name], select[name], textarea[name], [data-iris-field]',
  )
  for (const el of Array.from(controls)) {
    const name = el.getAttribute('name') ?? el.getAttribute('data-iris-field')
    if (name && keys.includes(name)) {
      el.focus()
      try {
        el.scrollIntoView({ block: 'center' })
      } catch {
        /* scrollIntoView is unavailable in jsdom — focus is the contract */
      }
      return
    }
  }
}

export interface IrisFormProps<V extends FormValues> extends Omit<
  React.FormHTMLAttributes<HTMLFormElement>,
  'onSubmit'
> {
  /** The store from `useForm(...).form`. */
  form: FormStore<V>
  children?: React.ReactNode
}

/**
 * Provides the form store to descendant `useField` calls and wires the native
 * `<form>` submit to `handleSubmit` (with `preventDefault`).
 *
 * @example
 *   const f = useForm({ initialValues: { email: '' }, onSubmit })
 *   <IrisForm form={f.form}>
 *     <IrisFormField label="Email"><EmailField /></IrisFormField>
 *     <IrisButton type="submit" disabled={f.isSubmitting}>Save</IrisButton>
 *   </IrisForm>
 */
export function IrisForm<V extends FormValues>({ form, children, ...rest }: IrisFormProps<V>) {
  const formRef = React.useRef<HTMLFormElement | null>(null)
  return (
    <FormContext.Provider value={form as unknown as FormStore<FormValues>}>
      <form
        {...rest}
        ref={formRef}
        data-iris-form=""
        onSubmit={(event) => {
          event.preventDefault()
          // On a failed submit, move focus to the first errored field (a11y).
          void form
            .handleSubmit()
            .then(() => focusFirstError(formRef.current, form.getState().errors))
        }}
      >
        {children}
      </form>
    </FormContext.Provider>
  )
}
