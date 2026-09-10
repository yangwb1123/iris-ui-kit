import { validateEditRules, validateEditRulesAsync, type EditValidationSource } from './edit-rules'
import type { TableRowEditOptions } from './table-row-edit-types'

export type ValidationResult = string | null | undefined

export interface ValidationOutcome {
  readonly error: ValidationResult
  readonly source: EditValidationSource
}

export type Validation = ValidationOutcome | PromiseLike<ValidationOutcome>

export function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    ((typeof value === 'object' && value !== null) || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

export function rejectedValidationMessage(reason: unknown): string {
  return reason instanceof Error && reason.message ? reason.message : 'Value is invalid'
}

export function validationOutcome(
  error: ValidationResult,
  source: EditValidationSource,
): ValidationOutcome {
  return { error: error ?? null, source }
}

export function createTableRowEditValidator<Row, Column, Key extends string | number>(
  options: TableRowEditOptions<Row, Column, Key>,
): (draft: unknown, row: Row, column: Column, coercedValue: unknown) => Validation {
  const validateCustom = (
    value: unknown,
    row: Row,
    column: Column,
    successSource: EditValidationSource,
  ): Validation => {
    if (!options.validate) return validationOutcome(null, successSource)
    try {
      const result = options.validate(value, row, column)
      if (isPromiseLike<ValidationResult>(result)) {
        return Promise.resolve(result).then(
          (error) => validationOutcome(error, error ? 'custom' : successSource),
          (reason: unknown) => validationOutcome(rejectedValidationMessage(reason), 'custom'),
        )
      }
      return validationOutcome(result, result ? 'custom' : successSource)
    } catch (reason) {
      return validationOutcome(rejectedValidationMessage(reason), 'custom')
    }
  }

  return (draft, row, column, coercedValue): Validation => {
    const rules = options.getEditRules?.(column)
    if (rules && rules.length > 0) {
      const context = {
        rows: options.getRows(),
        columnKey: options.getColumnKey(column),
        getValue: (candidate: Row) => options.getCellValue(candidate, column),
      }
      // A rule with a custom validator is allowed to be async. Use the async
      // engine for that path so the validator is called exactly once. Built-in
      // declarative rules stay synchronous, preserving immediate failures for
      // required/min/max/type/pattern/unique rules.
      if (rules.some((rule) => rule.validator !== undefined)) {
        return validateEditRulesAsync(rules, draft, row, false, context).then(
          (result) => {
            if (!result.valid) {
              return validationOutcome(result.messages[0] ?? 'Value is invalid', 'editRules')
            }
            return validateCustom(coercedValue, row, column, 'editRules')
          },
          (reason: unknown) => validationOutcome(rejectedValidationMessage(reason), 'editRules'),
        )
      }
      const result = validateEditRules(rules, draft, row, false, context)
      if (!result.valid) {
        return validationOutcome(result.messages[0] ?? 'Value is invalid', 'editRules')
      }
      return validateCustom(coercedValue, row, column, 'editRules')
    }
    return validateCustom(coercedValue, row, column, options.validate ? 'custom' : 'none')
  }
}
