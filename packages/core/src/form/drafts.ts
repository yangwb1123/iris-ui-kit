import { formatPath, getByPath, parsePath, setByPath, type PathSegment } from '../path'
import type { FieldFlags, FormValues } from './types'

export function serializeFormDraft<V extends FormValues>(
  values: V,
  touched: FieldFlags<V>,
  options?: { includeTouched?: boolean; exclude?: (keyof V)[] },
): { values: Partial<V>; touched?: FieldFlags<V> } {
  const nextValues = cloneFormDraftValue(values) as Partial<V>
  for (const key of options?.exclude ?? []) delete nextValues[key]
  return {
    values: nextValues,
    ...(options?.includeTouched !== false ? { touched: { ...touched } } : {}),
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Detach draft data without changing the identity of opaque user objects. */
export function cloneFormDraftValue(
  value: unknown,
  seen = new WeakMap<object, unknown>(),
): unknown {
  if (value === null || typeof value !== 'object') return value
  const previous = seen.get(value)
  if (previous !== undefined) return previous

  if (Array.isArray(value)) {
    const copy: unknown[] = []
    seen.set(value, copy)
    for (const item of value) copy.push(cloneFormDraftValue(item, seen))
    return copy
  }
  if (!isPlainObject(value)) return value

  const copy = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>
  seen.set(value, copy)
  for (const key of Object.keys(value)) {
    Object.defineProperty(copy, key, {
      configurable: true,
      enumerable: true,
      value: cloneFormDraftValue(value[key], seen),
      writable: true,
    })
  }
  return copy
}

function samePathPrefix(path: readonly PathSegment[], key: string): boolean {
  const keySegments = parsePath(key)
  return (
    keySegments.length >= path.length &&
    path.every((segment, index) => keySegments[index] === segment)
  )
}

/**
 * Reconcile a supplied draft subtree against the initial subtree. Leaves are
 * recorded at canonical paths; aggregate paths are reserved for structural
 * changes that cannot be represented by a concrete supplied leaf.
 */
function reconcileDirty(
  value: unknown,
  initial: unknown,
  path: readonly PathSegment[],
  dirty: Record<string, boolean | undefined>,
): boolean {
  if (Object.is(value, initial)) return false

  if (Array.isArray(value) && Array.isArray(initial)) {
    let changed = value.length !== initial.length
    const commonLength = Math.min(value.length, initial.length)
    for (let index = 0; index < commonLength; index++) {
      changed = reconcileDirty(value[index], initial[index], [...path, index], dirty) || changed
    }
    for (let index = commonLength; index < value.length; index++) {
      changed = reconcileDirty(value[index], undefined, [...path, index], dirty) || changed
    }
    // A length change is a structural difference, even when the added value is
    // undefined and therefore has no changed leaf under Object.is.
    if (value.length !== initial.length) dirty[formatPath(path)] = true
    return changed
  }

  if (isPlainObject(value) && isPlainObject(initial)) {
    const valueKeys = Object.keys(value)
    const initialKeys = Object.keys(initial)
    let structural = valueKeys.length !== initialKeys.length
    if (!structural) {
      for (const key of valueKeys) {
        if (!Object.prototype.hasOwnProperty.call(initial, key)) {
          structural = true
          break
        }
      }
    }

    let changed = structural
    for (const key of valueKeys) {
      changed = reconcileDirty(value[key], initial[key], [...path, key], dirty) || changed
    }
    if (structural) dirty[formatPath(path)] = true
    return changed
  }

  // A container replacing a different kind of value is structural. Recurse
  // into supplied children so callers still get concrete leaf paths as well.
  if (Array.isArray(value)) {
    let changed = true
    for (let index = 0; index < value.length; index++) {
      changed = reconcileDirty(value[index], undefined, [...path, index], dirty) || changed
    }
    dirty[formatPath(path)] = true
    return changed
  }
  if (isPlainObject(value)) {
    let changed = true
    for (const key of Object.keys(value)) {
      changed = reconcileDirty(value[key], undefined, [...path, key], dirty) || changed
    }
    dirty[formatPath(path)] = true
    return changed
  }

  dirty[formatPath(path)] = true
  return true
}

/** Remove a dirty entry at `path` and every concrete descendant. */
function clearDirtySubtree(dirty: Record<string, boolean | undefined>, path: PathSegment[]): void {
  for (const key of Object.keys(dirty)) {
    if (samePathPrefix(path, key)) delete dirty[key]
  }
}

export function hydrateFormDraft<V extends FormValues>(
  current: { values: V; dirty: FieldFlags<V>; touched: FieldFlags<V> },
  draft: { values: Partial<V>; touched?: FieldFlags<V> },
  initialValues: V,
): { values: V; dirty: FieldFlags<V>; touched: FieldFlags<V> } {
  const nextDirty: Record<string, boolean | undefined> = { ...current.dirty }
  let nextValues = current.values

  for (const rawKey of Object.keys(draft.values)) {
    const path = parsePath(rawKey)
    const key = formatPath(path)
    const value = cloneFormDraftValue((draft.values as Record<string, unknown>)[rawKey])
    clearDirtySubtree(nextDirty, path)
    nextValues = setByPath(nextValues, key, value) as V
    reconcileDirty(value, getByPath(initialValues, key), path, nextDirty)
  }

  return {
    values: nextValues,
    dirty: nextDirty as FieldFlags<V>,
    touched: draft.touched ? { ...current.touched, ...draft.touched } : current.touched,
  }
}
