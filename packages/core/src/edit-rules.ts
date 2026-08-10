/**
 * Edit-rule engine for editable tables (vxe-grid `editRules` parity).
 *
 * A column declares an ordered rule list; each rule validates the draft and
 * returns the first failing message (or all messages with `collectAll`).
 * Rules support sync/async validators and built-in checks:
 *   required / min / max / type (number|string|array) / pattern / validator
 *
 * Framework-agnostic — the table adapters bridge it into their edit
 * sessions (IrisTable `editRules` column config + `editConfig`).
 */

export interface EditRule<Row = unknown> {
  /** Field must be non-empty (trimmed string / array length / non-NaN number). */
  required?: boolean
  /** Minimum: string/array length, or numeric value. */
  min?: number
  /** Maximum: string/array length, or numeric value. */
  max?: number
  /** Expected value type. */
  type?: 'number' | 'string' | 'array'
  /** Regex the string value must match (for non-string values, String(v) is tested). */
  pattern?: string | RegExp
  /** Custom validator — sync (return string|null) or async (resolve string|null). */
  validator?: (
    value: unknown,
    row: Row,
  ) => string | null | undefined | Promise<string | null | undefined>
  /** Error message. Built-in rules fall back to a default message. */
  message?: string
  /** When validation runs: 'blur' | 'change' | 'manual' (default 'change'). */
  trigger?: 'blur' | 'change' | 'manual'
}

export type EditRules<Row = unknown> = EditRule<Row>[]

export interface EditRuleResult {
  valid: boolean
  /** First failing message (or all messages with collectAll). */
  messages: string[]
}

const DEFAULT_MESSAGES: Record<string, string> = {
  required: 'This field is required',
  min: 'Value is too small',
  max: 'Value is too large',
  type: 'Value type is invalid',
  pattern: 'Value format is invalid',
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'number') return Number.isNaN(value)
  return false
}

function validateRule<Row>(rule: EditRule<Row>, value: unknown, row: Row): string | null {
  if (rule.required && isEmpty(value)) {
    return rule.message ?? DEFAULT_MESSAGES.required
  }
  if (!isEmpty(value)) {
    if (rule.type === 'number' && typeof value !== 'number') {
      return rule.message ?? DEFAULT_MESSAGES.type
    }
    if (rule.type === 'string' && typeof value !== 'string') {
      return rule.message ?? DEFAULT_MESSAGES.type
    }
    if (rule.type === 'array' && !Array.isArray(value)) {
      return rule.message ?? DEFAULT_MESSAGES.type
    }
    const len = typeof value === 'string' || Array.isArray(value) ? value.length : undefined
    if (rule.min !== undefined) {
      const n = typeof value === 'number' ? value : len
      if (n === undefined || n < rule.min) return rule.message ?? DEFAULT_MESSAGES.min
    }
    if (rule.max !== undefined) {
      const n = typeof value === 'number' ? value : len
      if (n === undefined || n > rule.max) return rule.message ?? DEFAULT_MESSAGES.max
    }
    if (rule.pattern !== undefined) {
      const re = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern)
      if (!re.test(String(value))) return rule.message ?? DEFAULT_MESSAGES.pattern
    }
  }
  if (rule.validator) {
    // Validator handles its own emptiness semantics; run it regardless.
    const result = rule.validator(value, row)
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      // Async — handled by validateRulesAsync; sync path returns a sentinel.
      return undefined as never
    }
    return (result as string | null | undefined) ?? null
  }
  return null
}

/**
 * Validate a value against a rule list (sync rules only). Returns the first
 * failing message unless `collectAll`.
 */
export function validateEditRules<Row = unknown>(
  rules: EditRules<Row> | undefined,
  value: unknown,
  row: Row,
  collectAll = false,
): EditRuleResult {
  if (!rules || rules.length === 0) return { valid: true, messages: [] }
  const messages: string[] = []
  for (const rule of rules) {
    if (rule.validator) {
      const result = rule.validator(value, row)
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        // Async validator — resolve via the async API instead.
        continue
      }
      if (result) messages.push(result as string)
    } else {
      const message = validateRule({ ...rule, validator: undefined }, value, row)
      if (message) messages.push(message)
    }
    if (!collectAll && messages.length > 0) break
  }
  return { valid: messages.length === 0, messages }
}

/**
 * Validate a value against a rule list including async validators.
 * Returns the first failing message unless `collectAll`.
 */
export async function validateEditRulesAsync<Row = unknown>(
  rules: EditRules<Row> | undefined,
  value: unknown,
  row: Row,
  collectAll = false,
): Promise<EditRuleResult> {
  if (!rules || rules.length === 0) return { valid: true, messages: [] }
  const messages: string[] = []
  for (const rule of rules) {
    if (rule.validator) {
      const result = await rule.validator(value, row)
      if (result) messages.push(result)
    } else {
      const message = validateRule({ ...rule, validator: undefined }, value, row)
      if (message) messages.push(message)
    }
    if (!collectAll && messages.length > 0) break
  }
  return { valid: messages.length === 0, messages }
}
