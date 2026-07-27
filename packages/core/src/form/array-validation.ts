import { getByPath } from '../path'

type RuntimeValidator<V> = (
  value: unknown,
  values: V,
) => string | undefined | Promise<string | undefined>

const indexedArrayField = /^(\w+(?:\.\w+)*)\[(\d+)\]\.(.+)$/
const arrayFieldPattern = /^(\w+(?:\.\w+)*)\[\]\.(.+)$/

function validatorFor<V>(validators: object, key: string): RuntimeValidator<V> | undefined {
  const map = validators as Readonly<Record<string, RuntimeValidator<V> | undefined>>
  const direct = map[key]
  if (direct) return direct

  const match = key.match(indexedArrayField)
  return match ? map[`${match[1]}[].${match[3]}`] : undefined
}

/**
 * Run a direct validator or the matching `items[].field` pattern validator.
 * Synchronous throws become field errors; rejected promises remain rejections
 * so the form store's race-safe cleanup path remains authoritative.
 */
export async function runFormFieldValidator<V extends object>(
  validators: object,
  key: string,
  values: V,
): Promise<string | undefined> {
  const validator = validatorFor<V>(validators, key)
  if (!validator) return undefined
  try {
    return validator(getByPath(values, key), values)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export interface FormValidationPlan {
  names: string[]
  tokenById: Map<string, number>
}

/**
 * Expand `items[].field` validator keys to the concrete rows in current values
 * and reserve validation tokens before the concurrent form-wide pass starts.
 */
export function createFormValidationPlan(
  values: object,
  validators: object,
  nextToken: (name: string) => number,
): FormValidationPlan {
  const baseNames = Object.keys(validators)
  const names: string[] = []

  for (const name of baseNames) {
    const match = name.match(arrayFieldPattern)
    if (!match) {
      names.push(name)
      continue
    }
    const [, arrayPath, subField] = match
    const value = getByPath(values, arrayPath)
    const length = Array.isArray(value) ? value.length : 0
    for (let index = 0; index < length; index++) {
      names.push(`${arrayPath}[${index}].${subField}`)
    }
  }

  const tokenById = new Map<string, number>()
  for (const name of baseNames) {
    const token = nextToken(name)
    if (!arrayFieldPattern.test(name)) tokenById.set(name, token)
  }
  for (const name of names) {
    if (!tokenById.has(name)) tokenById.set(name, nextToken(name))
  }

  return { names, tokenById }
}
