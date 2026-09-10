import { rekeyByArrayMutation } from '../path'
import { cloneFormDraftValue } from './drafts'
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
  const rekeyValidating = (
    map: FieldFlags<V>,
    prefix: string,
    remap: (index: number) => number | null,
  ): FieldFlags<V> => {
    const out = rekeyByArrayMutation(map as Record<string, boolean>, prefix, remap) as Record<
      string,
      boolean | undefined
    >
    // Array mutations invalidate field validators. Preserve the remapped
    // shape for already-cleared entries, but never carry an active flag into a
    // new row while setFieldValue cancels the old field run.
    const indexPrefix = `${prefix}[`
    for (const key of Object.keys(out)) {
      const rest = key.slice(indexPrefix.length)
      if (key.startsWith(indexPrefix) && /^\d+\](?:[.[\]]|$)/.test(rest)) out[key] = false
    }
    return out as FieldFlags<V>
  }

  const rekeyElements = (prefix: string, remap: (index: number) => number | null): void =>
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
      validating: rekeyValidating(state.validating, prefix, remap),
    }))

  const updateArray = <K extends ArrayKey<V>>(
    name: K,
    fn: (array: ArrayElement<V[K]>[]) => ArrayElement<V[K]>[],
    remap?: (index: number) => number | null,
  ): void => {
    const prefix = options.pathKey(name)
    if (remap) rekeyElements(prefix, remap)
    const current = options.readValues()[name]
    const array = Array.isArray(current) ? (current as ArrayElement<V[K]>[]) : []
    options.setFieldValue(name, fn(array.slice()) as unknown as V[K])
  }

  const arrayPush: FormStore<V>['arrayPush'] = (name, item) => {
    const detachedItem = cloneFormDraftValue(item) as ArrayElement<V[typeof name]>
    updateArray(name, (array) => {
      array.push(detachedItem)
      return array
    })
  }

  const arrayInsert: FormStore<V>['arrayInsert'] = (name, index, item) => {
    const detachedItem = cloneFormDraftValue(item) as ArrayElement<V[typeof name]>
    const current = options.readValues()[name]
    const length = Array.isArray(current) ? current.length : 0
    const numericIndex = typeof index === 'number' ? index : Number.NaN
    const at = Number.isNaN(numericIndex)
      ? 0
      : Math.max(0, Math.min(Math.trunc(numericIndex), length))
    updateArray(
      name,
      (array) => {
        array.splice(at, 0, detachedItem)
        return array
      },
      (i) => (i >= at ? i + 1 : i),
    )
  }

  const arrayRemove: FormStore<V>['arrayRemove'] = (name, index) => {
    const current = options.readValues()[name]
    const length = Array.isArray(current) ? current.length : 0
    if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || index >= length)
      return
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
    if (
      typeof a !== 'number' ||
      typeof b !== 'number' ||
      !Number.isSafeInteger(a) ||
      !Number.isSafeInteger(b) ||
      a < 0 ||
      a >= length ||
      b < 0 ||
      b >= length
    )
      return
    updateArray(
      name,
      (array) => {
        const hasA = Object.prototype.hasOwnProperty.call(array, a)
        const hasB = Object.prototype.hasOwnProperty.call(array, b)
        const tmp = array[a]
        if (hasB) array[a] = array[b]!
        else delete array[a]
        if (hasA) array[b] = tmp!
        else delete array[b]
        return array
      },
      (i) => (i === a ? b : i === b ? a : i),
    )
  }

  const arrayMove: FormStore<V>['arrayMove'] = (name, from, to) => {
    const current = options.readValues()[name]
    const length = Array.isArray(current) ? current.length : 0
    if (
      typeof from !== 'number' ||
      typeof to !== 'number' ||
      !Number.isSafeInteger(from) ||
      !Number.isSafeInteger(to) ||
      from < 0 ||
      from >= length ||
      to < 0 ||
      to >= length
    )
      return
    updateArray(
      name,
      (array) => {
        const wasPresent = Object.prototype.hasOwnProperty.call(array, from)
        const [moved] = array.splice(from, 1)
        array.splice(to, 0, moved!)
        if (!wasPresent) delete array[to]
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
