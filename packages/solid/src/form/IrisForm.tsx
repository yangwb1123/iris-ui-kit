import { type JSX } from 'solid-js'
import type { FormStore, FormValues } from '@iris-ui-kit/core'
import { FormContext } from './context'

/** Focus (and best-effort scroll to) the first errored named control in DOM order. */
function focusFirstError(
  formEl: HTMLFormElement | undefined,
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

export interface IrisFormProps<V extends FormValues = FormValues> {
  form: FormStore<V>
  children?: JSX.Element
}

/**
 * Provides the form store to descendant `useField` calls and wires the native
 * `<form>` submit to `handleSubmit` (with `preventDefault`).
 * Solid port of the Vue IrisForm.
 */
export function IrisForm<V extends FormValues = FormValues>(props: IrisFormProps<V>): JSX.Element {
  let formEl: HTMLFormElement | undefined
  return (
    <FormContext.Provider value={props.form as FormStore<FormValues>}>
      <form
        ref={formEl}
        data-iris-form=""
        onSubmit={(e) => {
          e.preventDefault()
          void props.form
            .handleSubmit()
            .then(() => focusFirstError(formEl, props.form.getState().errors))
        }}
      >
        {props.children}
      </form>
    </FormContext.Provider>
  )
}
