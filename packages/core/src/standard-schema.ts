import type { FieldErrors, FormValues } from './form'
import { formatPath, type PathSegment } from './path'

/**
 * Pluggable schema validation via the **Standard Schema** spec (the `~standard`
 * interface implemented by Zod 3.24+, Valibot, ArkType, …). The consumer brings
 * their schema library; Iris stays dependency-free and library-agnostic.
 *
 * ```ts
 * import { z } from 'zod'
 * const schema = z.object({ email: z.string().email(), age: z.number().min(18) })
 * const form = createFormStore({ initialValues, validate: standardSchemaValidator(schema) })
 * ```
 */

/** Minimal structural view of a Standard Schema (avoids a spec dependency). */
export interface StandardSchemaV1<Output = unknown> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>
  }
}

type StandardResult<T> = { value: T; issues?: undefined } | { issues: ReadonlyArray<StandardIssue> }

interface StandardIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
}

/** Normalize ONE Standard Schema path element to a path segment. Zod/Valibot
 * differ: a segment is either a raw `PropertyKey` or an object with a `key`. */
function segmentOf(seg: PropertyKey | { readonly key: PropertyKey }): PathSegment {
  const raw = typeof seg === 'object' ? seg.key : seg
  if (typeof raw === 'symbol') return raw.toString()
  if (typeof raw === 'number') return raw
  // A numeric-string key (e.g. an array index serialized as "2") becomes an
  // index segment, so `items.2.sku` formats canonically to `items[2].sku`.
  return /^\d+$/.test(raw) ? Number(raw) : raw
}

/**
 * Map a schema issue to the canonical FULL-path key of the field it concerns
 * (v3 R19): `issue.path` is joined into `a.b[2].c`, so a nested Zod/Valibot
 * error lands on the right nested field instead of collapsing to the top-level
 * key. Returns `undefined` for a form-level issue with no path.
 */
function issueKey(issue: StandardIssue): string | undefined {
  if (!issue.path || issue.path.length === 0) return undefined
  return formatPath(issue.path.map(segmentOf))
}

/**
 * Adapt a Standard Schema into a form-level `validate` function: it runs the
 * schema over the values and maps each issue to its field's FULL-path key
 * (`items[2].sku`, not `items`); first issue per field wins. Returns `{}` when
 * valid. Works for sync or async schemas — always returns a Promise.
 */
export function standardSchemaValidator<V extends FormValues>(
  schema: StandardSchemaV1,
): (values: V) => Promise<FieldErrors<V>> {
  return async (values: V): Promise<FieldErrors<V>> => {
    const result = await schema['~standard'].validate(values)
    if (!result.issues) return {}
    const errors: FieldErrors<V> = {}
    for (const issue of result.issues) {
      const key = issueKey(issue)
      if (key != null && !(key in errors)) {
        errors[key as keyof FieldErrors<V>] = issue.message as FieldErrors<V>[keyof FieldErrors<V>]
      }
    }
    return errors
  }
}
