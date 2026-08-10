/**
 * Pure materials for the vxe-grid formConfig parity search form (batch D).
 * Framework-free: every adapter bridges state + rendering, while seeding the
 * draft, building submitted values and merging form values into the filter
 * map are single-sourced here so all four frameworks share one behavior.
 *
 * Semantics follow vxe-grid: fields carry `defaultValue` (also the value a
 * reset restores), and an empty-string value is an INACTIVE filter (stripped
 * at every boundary so `{ name: '' }` and `{}` are the same state).
 */

/** Shape of a form field the materials need (a structural subset of the
 * adapter's `IrisTableFormField`). */
export interface TableFormFieldSpec {
  key: string
  defaultValue?: string
}

/**
 * Seed a form draft from field `defaultValue`s. Fields without a default (or
 * with an empty default) get no entry — the control renders its placeholder.
 */
export function seedFormValues(
  fields: ReadonlyArray<TableFormFieldSpec> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!fields) return out
  for (const field of fields) {
    if (field.defaultValue != null && field.defaultValue !== '') {
      out[field.key] = field.defaultValue
    }
  }
  return out
}

/**
 * Build the submitted values from a form draft: every declared field, with
 * empty strings stripped (vxe contract: `''` means "no filter"). A field the
 * draft never touched is absent from the result.
 */
export function buildFormValues(
  fields: ReadonlyArray<TableFormFieldSpec> | undefined,
  draft: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!fields) return out
  for (const field of fields) {
    const value = draft[field.key]
    if (value != null && value !== '') out[field.key] = value
  }
  return out
}

/**
 * Merge form values over a base filter map WITHOUT mutating either input:
 * empty-string entries are dropped, and on key conflict the form value wins.
 * The result is a fresh object, so the caller's `filters` prop reference is
 * never touched (local-mode filtering merges the prop + applied form values).
 */
export function mergeFormFilters(
  base: Record<string, string>,
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(base)) {
    if (base[key] !== '') out[key] = base[key]
  }
  for (const key of Object.keys(values)) {
    if (values[key] !== '') out[key] = values[key]
  }
  return out
}
