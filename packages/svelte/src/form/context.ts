import { getContext, setContext } from 'svelte'
import type { FormStore, FormValues } from '@iris-ui-kit/core'

const FORM_KEY = Symbol('IrisForm')

export function setFormContext(store: FormStore<FormValues>): void {
  setContext(FORM_KEY, store)
}

export function getFormContext(): FormStore<FormValues> {
  const store = getContext<FormStore<FormValues>>(FORM_KEY)
  if (!store) throw new Error('useField / getFormContext must be used within an <IrisForm>')
  return store
}
