import { rekeyByArrayMutation } from '../path'
import type {
  ArrayElement,
  ArrayKey,
  FieldErrors,
  FieldFlags,
  FieldPath,
  FormStore,
  FormValues,
} from './types'

export interface FormArrayOperations<V extends FormValues> {
  arrayPush: FormStore<V>['arrayPush']
  arrayInsert: FormStore<V>['arrayInsert']
  arrayRemove: FormStore<V>['arrayRemove']
  arraySwap: FormStore<V>['arraySwap']
  arrayMove: FormStore<V>['arrayMove']
}

/** Create immutable array-field operations plus per-index metadata remapping. */
export function createFormArrayOperations<V extends FormValues>(options: {
  readValues: () => V
  setFieldValue: (ref: FieldPath<V>, value: unknown) => void
  updateState: (
    update: (state: {
      errors: FieldErrors<V>
      touched: FieldFlags<V>
      dirty: FieldFlags<V>
      validating: FieldFlags<V>
    }) => {
      errors: FieldErrors<V>
      touched: FieldFlags<V>
      dirty: FieldFlags<V>
      validating: FieldFlags<V>
    },
  ) => void
  pathKey: (ref: FieldPath<unknown>) => string
}): FormArrayOperations<V> {
  const rekeyElements = (prefix: string, remap: (index: number) => number | null): void => {
    options.updateState((state) => ({
      errors: rekeyByArrayMutation(
        state.errors as Record<string, string>,
        prefix,
        remap,
      ) as FieldErrors<V>,
      touched: rekeyByArrayMutation(
        state.touched as Record<string, boolean>,
        prefix,
        remap,
      ) as FieldFlags<V>,
      dirty: rekeyByArrayMutation(
        state.dirty as Record<string, boolean>,
        prefix,
        remap,
      ) as FieldFlags<V>,
      validating: rekeyByArrayMutation(
        state.validating as Record<string, boolean>,
        prefix,
        remap,
      ) as FieldFlags<V>,
    }))
  }

  const updateArray = <K extends ArrayKey<V>>(
    name: K,
    fn: (array: ArrayElement<V[K]>[]) => ArrayElement<V[K]>[],
    remap?: (index: number) => number | null,
  ): void => {
    const prefix = options.pathKey(name)
    if (remap) rekeyElements(prefix, remap)
    const current = options.readValues()[name]
    const array = Array.isArray(current) ? (current as ArrayElement<V[K]>[]) : []
    options.setFieldValue(name, fn([...array]) as unknown as V[K])
  }

  const arrayPush: FormStore<V>['arrayPush'] = (name, item) =>
    updateArray(name, (array) => {
      array.push(item)
      return array
    })

  const arrayInsert: FormStore<V>['arrayInsert'] = (name, index, item) => {
    const current = options.readValues()[name]
    const length = Array.isArray(current) ? current.length : 0
    const at = Math.max(0, Math.min(index, length))
    updateArray(
      name,
      (array) => {
        array.splice(at, 0, item)
        return array
      },
      (i) => (i >= at ? i + 1 : i),
    )
  }

  const arrayRemove: FormStore<V>['arrayRemove'] = (name, index) => {
    const current = options.readValues()[name]
    const length = Array.isArray(current) ? current.length : 0
    if (index < 0 || index >= length) return
    updateArray(
      name,
      (array) => {
        array.splice(index, 1)
        return array
      },
      (i) => (i === index ? null : i > index ? i - 1 : i),
    )
  }

  const arraySwap: FormStore<V>['arraySwap'] = (name, a, b) => {
    const current = options.readValues()[name]
    const length = Array.isArray(current) ? current.length : 0
    if (a < 0 || a >= length || b < 0 || b >= length) return
    updateArray(
      name,
      (array) => {
        const tmp = array[a]!
        array[a] = array[b]!
        array[b] = tmp
        return array
      },
      (i) => (i === a ? b : i === b ? a : i),
    )
  }

  const arrayMove: FormStore<V>['arrayMove'] = (name, from, to) => {
    const current = options.readValues()[name]
    const length = Array.isArray(current) ? current.length : 0
    if (from < 0 || from >= length || to < 0 || to >= length) return
    updateArray(
      name,
      (array) => {
        const [moved] = array.splice(from, 1)
        array.splice(to, 0, moved!)
        return array
      },
      (i) => {
        if (i === from) return to
        if (from < to) return i > from && i <= to ? i - 1 : i
        return i >= to && i < from ? i + 1 : i
      },
    )
  }

  return { arrayPush, arrayInsert, arrayRemove, arraySwap, arrayMove }
}
