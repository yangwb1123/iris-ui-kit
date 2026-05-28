import * as React from 'react'
import type { FormStore, FormValues } from '@iris-ui/core'
import { FormContext } from './context'

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
 * `<form>` submit to `handleSubmit` (with `preventDefault`). Composition:
 *
 * ```tsx
 * const f = useForm({ initialValues: { email: '' }, onSubmit })
 * <IrisForm form={f.form}>
 *   <IrisFormField label="Email"><EmailField /></IrisFormField>
 *   <IrisButton type="submit" disabled={f.isSubmitting}>Save</IrisButton>
 * </IrisForm>
 * ```
 */
export function IrisForm<V extends FormValues>({ form, children, ...rest }: IrisFormProps<V>) {
  return (
    <FormContext.Provider value={form as unknown as FormStore<FormValues>}>
      <form
        {...rest}
        data-iris-form=""
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        {children}
      </form>
    </FormContext.Provider>
  )
}
