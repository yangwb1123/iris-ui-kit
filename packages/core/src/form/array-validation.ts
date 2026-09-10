import { getByPath } from '../path'

type RuntimeValidator<V> = (
  value: unknown,
  values: V,
) => string | undefined | Promise<string | undefined>

function validatorFor<V>(validators: object, key: string): RuntimeValidator<V> | undefined {
  const map = validators as Readonly<Record<string, RuntimeValidator<V> | undefined>>
  if (Object.prototype.hasOwnProperty.call(map, key)) {
    const direct = map[key]
    if (direct) return direct
  }

  // Replace every concrete array index so nested arrays and path segments
  // containing hyphens/spaces use the same `items[].field` pattern contract.
  const pattern = key.replace(/\[(\d+)\]/g, '[]')
  return pattern !== key && Object.prototype.hasOwnProperty.call(map, pattern)
    ? map[pattern]
    : undefined
}

function expandArrayPattern(values: object, name: string): string[] {
  const marker = name.indexOf('[]')
  if (marker < 0) return [name]
  const arrayPath = name.slice(0, marker)
  const suffix = name.slice(marker + 2)
  const value = getByPath(values, arrayPath)
  if (!Array.isArray(value)) return []
  const names: string[] = []
  for (let index = 0; index < value.length; index++) {
    names.push(...expandArrayPattern(values, `${arrayPath}[${index}]${suffix}`))
  }
  return names
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
}

/** Expand `items[].field` validator keys to concrete rows in current values. */
export function createFormValidationPlan(values: object, validators: object): FormValidationPlan {
  const baseNames = Object.keys(validators)
  const names: string[] = []

  for (const name of baseNames) names.push(...expandArrayPattern(values, name))

  return { names }
}
