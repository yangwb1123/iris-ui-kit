import { getByPath, setByPath, rekeyByArrayMutation } from '../path'
import type { FormValues, FieldPath, FieldErrors, FieldFlags } from './types'
import { pathKey } from './types'

/**
 * Value manipulation helpers for the form engine.
 *
 * Each operation is pure (returns new state slices) so the form store
 * can apply them with structural sharing.
 */

export interface FieldValueOps<V extends FormValues> {
  setFieldValue: (
    state: { values: V; dirty: FieldFlags<V> },
    ref: FieldPath<V>,
    value: unknown,
    initialValues: V,
  ) => { values: V; dirty: FieldFlags<V> }
  getFieldValue: (values: V, ref: FieldPath<V>) => unknown
  setValues: (
    state: { values: V; dirty: FieldFlags<V> },
    values: Partial<V>,
    initialValues: V,
  ) => { values: V; dirty: FieldFlags<V> }
  isDirty: (value: unknown, initialValue: unknown) => boolean
}

export function createFieldValueOps<V extends FormValues>(): FieldValueOps<V> {
  const isDirty = (value: unknown, initialValue: unknown): boolean =>
    !Object.is(value, initialValue)

  return {
    setFieldValue(state, ref, value, initialValues) {
      const key = pathKey(ref)
      return {
        values: setByPath(state.values, key, value) as V,
        dirty: { ...state.dirty, [key]: isDirty(value, getByPath(initialValues, key)) },
      }
    },

    getFieldValue(values, ref) {
      return getByPath(values, ref as Parameters<typeof getByPath>[1])
    },

    setValues(state, partial, initialValues) {
      const keys = Object.keys(partial) as (keyof V & string)[]
      const nextValues = { ...state.values }
      const nextDirty = { ...state.dirty }
      for (const key of keys) {
        const v = partial[key]
        ;(nextValues as Record<string, unknown>)[key] = v as V[typeof key]
        ;(nextDirty as Record<string, boolean | undefined>)[key] = isDirty(v, initialValues[key])
      }
      return { values: nextValues, dirty: nextDirty }
    },

    isDirty,
  }
}

/**
 * Pure array item mutations.
 * Each returns a new array or null (when the operation is invalid).
 */

export function insertItem<T>(arr: T[], index: number, item: T): T[] {
  const copy = [...arr]
  const at = Math.max(0, Math.min(index, arr.length))
  copy.splice(at, 0, item)
  return copy
}

export function removeItem<T>(arr: T[], index: number): T[] | null {
  if (index < 0 || index >= arr.length) return null
  const copy = [...arr]
  copy.splice(index, 1)
  return copy
}

export function swapItems<T>(arr: T[], a: number, b: number): T[] | null {
  if (a < 0 || a >= arr.length || b < 0 || b >= arr.length) return null
  const copy = [...arr]
  const tmp = copy[a]!
  copy[a] = copy[b]!
  copy[b] = tmp
  return copy
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] | null {
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return null
  const copy = [...arr]
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved!)
  return copy
}

/**
 * Element-index remap functions.
 * Return a function that maps old element index → new index (or null to drop).
 */
export const insertRemap = (at: number) => (i: number) => (i >= at ? i + 1 : i)
export const removeRemap = (index: number) => (i: number) =>
  i === index ? null : i > index ? i - 1 : i
export const swapRemap = (a: number, b: number) => (i: number) => (i === a ? b : i === b ? a : i)
export const moveRemap = (from: number, to: number) => (i: number) => {
  if (i === from) return to
  if (from < to) return i > from && i <= to ? i - 1 : i
  return i >= to && i < from ? i + 1 : i
}

/**
 * Re-key per-element metadata when element indices shift.
 * Updates errors/touched/dirty/validating stored under prefix paths.
 */
export function rekeyMetadata<V extends FormValues>(
  metadata: {
    errors: FieldErrors<V>
    touched: FieldFlags<V>
    dirty: FieldFlags<V>
    validating: FieldFlags<V>
  },
  prefix: string,
  remap: (index: number) => number | null,
): {
  errors: FieldErrors<V>
  touched: FieldFlags<V>
  dirty: FieldFlags<V>
  validating: FieldFlags<V>
} {
  return {
    errors: rekeyByArrayMutation(
      metadata.errors as Record<string, string>,
      prefix,
      remap,
    ) as FieldErrors<V>,
    touched: rekeyByArrayMutation(
      metadata.touched as Record<string, boolean>,
      prefix,
      remap,
    ) as FieldFlags<V>,
    dirty: rekeyByArrayMutation(
      metadata.dirty as Record<string, boolean>,
      prefix,
      remap,
    ) as FieldFlags<V>,
    validating: rekeyByArrayMutation(
      metadata.validating as Record<string, boolean>,
      prefix,
      remap,
    ) as FieldFlags<V>,
  }
}
