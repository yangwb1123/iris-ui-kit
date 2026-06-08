import { type JSX } from 'solid-js'
import type { FormStore, FormValues } from '@iris-ui/core'
import { FormContext } from './context'

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
  return (
    <FormContext.Provider value={props.form as FormStore<FormValues>}>
      <form
        data-iris-form=""
        onSubmit={(e) => {
          e.preventDefault()
          void props.form.handleSubmit()
        }}
      >
        {props.children}
      </form>
    </FormContext.Provider>
  )
}
