import type { FieldErrors, FormValues } from './form'

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

function issueKey(issue: StandardIssue): string | undefined {
  const seg = issue.path?.[0]
  if (seg == null) return undefined
  const key = typeof seg === 'object' ? seg.key : seg
  return typeof key === 'symbol' ? key.toString() : String(key)
}

/**
 * Adapt a Standard Schema into a form-level `validate` function: it runs the
 * schema over the values and maps each issue to its top-level field (first
 * issue per field wins). Returns `{}` when valid. Works for sync or async
 * schemas — always returns a Promise.
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
