import type { FieldFlags, FormValues, Key } from './types'

export function serializeFormDraft<V extends FormValues>(
  values: V,
  touched: FieldFlags<V>,
  options?: { includeTouched?: boolean; exclude?: (keyof V)[] },
): { values: Partial<V>; touched?: FieldFlags<V> } {
  const nextValues: Partial<V> = { ...values }
  for (const key of options?.exclude ?? []) delete nextValues[key]
  return {
    values: nextValues,
    ...(options?.includeTouched !== false ? { touched: { ...touched } } : {}),
  }
}

export function hydrateFormDraft<V extends FormValues>(
  current: { values: V; dirty: FieldFlags<V>; touched: FieldFlags<V> },
  draft: { values: Partial<V>; touched?: FieldFlags<V> },
  initialValues: V,
): { values: V; dirty: FieldFlags<V>; touched: FieldFlags<V> } {
  const nextDirty: FieldFlags<V> = { ...current.dirty }
  const nextValues = { ...current.values }
  for (const key of Object.keys(draft.values) as Key<V>[]) {
    const value = draft.values[key]
    nextValues[key] = value as V[Key<V>]
    if (!Object.is(value, initialValues[key])) nextDirty[key] = true
  }
  return {
    values: nextValues,
    dirty: nextDirty,
    touched: draft.touched ? { ...current.touched, ...draft.touched } : current.touched,
  }
}
