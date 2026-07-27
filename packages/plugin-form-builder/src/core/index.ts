import {
  createFormStore,
  createPlugin,
  type FieldErrors,
  type FormState,
  type FormStore,
  type FormValues,
} from '@iris-ui-kit/core'

export type { FormValues } from '@iris-ui-kit/core'

/**
 * `@iris-ui-kit/plugin-form-builder` — render a working, validated form from a
 * declarative schema. This `core` entry is framework-agnostic: it COMPILES a
 * {@link FormSchema} into a `createFormStore` (initial values from field
 * defaults, validators from `required`) and exposes the field list for the four
 * thin renderers to draw. No new form logic — it composes the core form engine.
 */

export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'array'

export interface FieldOption {
  label: string
  value: string
}

export interface FieldSpec {
  /** Field key in the form values. */
  name: string
  /** Input kind. Default `'text'`. */
  type?: FieldType
  /** Visible label (defaults to the humanized name). */
  label?: string
  placeholder?: string
  /** Required — generates a "is required" validator + `aria-required`. */
  required?: boolean
  /** Options for `select`. */
  options?: FieldOption[]
  /** Seed value (defaults to `false` for checkbox, `[]` for array, `''` otherwise). */
  defaultValue?: unknown
  /**
   * Conditional visibility: the field is shown only when this returns true for
   * the current form values (e.g. `(v) => v.hasAccount === true`). A hidden
   * field is not rendered AND its `required` validator is skipped, so it never
   * silently blocks submit. Omitted = always visible.
   */
  when?: (values: FormValues) => boolean
  /**
   * Per-row sub-fields for an `array` (repeater) field. Each rendered row draws
   * one control per entry, bound to the nested path `${name}[${index}].${sub.name}`,
   * so per-row error/touched/dirty state is keyed by canonical path and follows
   * the row when rows are removed or reordered. Required when `type === 'array'`.
   * Required validators are compiled recursively for every current row.
   */
  fields?: FieldSpec[]
  /** Label for an `array` field's "add a row" button. Default `'Add'`. */
  addLabel?: string
  /** Label for an `array` field's per-row "remove" button. Default `'Remove'`. */
  removeLabel?: string
  /** Optional heading shown above each `array` row (e.g. `'Item'` → "Item 1"). */
  itemLabel?: string
}

export interface FormSchema {
  fields: FieldSpec[]
  /** Submit button label. Default `'Submit'`. */
  submitLabel?: string
  /**
   * Multi-step (wizard) configuration. Each entry lists the `name`s of the
   * fields it owns. When set, the renderer shows one step at a time and
   * "Submit" is replaced by "Next" until the final step.
   */
  steps?: Array<{ id?: string; fields: string[] }>
  /** Label for the "Next step" button. Default `'Next'`. */
  nextStepLabel?: string
}

export interface FormBuilderConfig {
  onSubmit?: (values: FormValues) => void | Promise<void>
  validateOnChange?: boolean
  /**
   * Normalize incoming values on init + every `reset` — e.g. coerce a numeric
   * string field to `number`. Passed through to the underlying `createFormStore`.
   */
  parse?: (values: FormValues) => FormValues
  /**
   * Normalize values just before `onSubmit` — e.g. trim strings. Does not
   * touch the form state. Passed through to the underlying `createFormStore`.
   */
  transform?: (values: FormValues) => FormValues
  /**
   * Cross-field re-validation: when a key changes, the listed fields are also
   * re-validated inline. E.g. `{ password: ['confirmPassword'] }`.
   */
  dependencies?: Partial<Record<string, string[]>>
  /**
   * Additional whole-form validation. Its errors are merged over validators
   * compiled from the schema, allowing domain-specific rules by nested path.
   */
  validate?: (values: FormValues) => FieldErrors<FormValues> | Promise<FieldErrors<FormValues>>
}

export interface FormBuilder {
  form: FormStore<FormValues>
  fields: FieldSpec[]
  submitLabel: string
  /** The resolved label for a field (explicit or humanized from its name). */
  labelOf(field: FieldSpec): string
  /** Whether a field is visible for the given values (its `when`, default true). */
  isVisible(field: FieldSpec, values: FormValues): boolean
  /** The fields visible for the given values — what renderers should draw. */
  visibleFields(values: FormValues): FieldSpec[]
  /** Total number of configured steps (1 when no `steps` in the schema). */
  stepCount: number
  /** Label for the "Next step" button (from schema, default `'Next'`). */
  nextStepLabel: string
  /**
   * The fields to render for the given state: respects both the current step
   * filter and each field's `when` predicate. Equivalent to `visibleFields`
   * when no `steps` are configured.
   */
  stepFields(state: FormState<FormValues>): FieldSpec[]
  /** True when the form is on the last (or only) step. */
  isLastStep(state: FormState<FormValues>): boolean
  /** Validate the current step and advance. Returns `false` if validation fails. */
  nextStep(): Promise<boolean>
  /** Navigate to the previous step without validating. */
  prevStep(): void
}

/** Humanize a camelCase / snake_case name into a Title Case label. */
function humanize(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function isEmpty(value: unknown): boolean {
  return value === '' || value === null || value === undefined || value === false
}

/** The seed value for a (non-array) field, per its type + explicit default. */
function seedValue(field: FieldSpec): unknown {
  if (field.type === 'array') return (field.defaultValue as unknown[]) ?? []
  return field.defaultValue ?? (field.type === 'checkbox' ? false : '')
}

/**
 * Build a fresh row object for an `array` field from its sub-field specs — the
 * value used when the renderer's "Add" button appends a row. A checkbox sub-field
 * seeds to `false`; every other type seeds to its `defaultValue ?? ''`. Shared by
 * all four framework renderers so their "add a row" payload is identical.
 */
export function arrayRowDefaults(field: FieldSpec): FormValues {
  const row: FormValues = {}
  for (const sub of field.fields ?? []) {
    row[sub.name] = seedValue(sub) as FormValues[string]
  }
  return row
}

/**
 * Compile required errors for every current array row, recursively. This is a
 * whole-form validator because row indices are dynamic: it discovers paths
 * from the current values on every pass, while the core form engine continues
 * to own metadata re-keying during remove/move operations.
 */
export function validateArrayFields(
  fields: FieldSpec[],
  values: FormValues,
): FieldErrors<FormValues> {
  const errors: FieldErrors<FormValues> = {}

  const visit = (
    specs: FieldSpec[],
    container: FormValues,
    prefix: string,
    nested: boolean,
  ): void => {
    for (const field of specs) {
      if (field.when && !field.when(values)) continue
      const path = prefix ? `${prefix}.${field.name}` : field.name
      const value = container[field.name]
      if (nested && field.required) {
        const missing =
          field.type === 'array' ? !Array.isArray(value) || value.length === 0 : isEmpty(value)
        if (missing) errors[path] = `${field.label ?? humanize(field.name)} is required`
      }

      if (field.type !== 'array' || !Array.isArray(value)) continue
      value.forEach((row, index) => {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
          visit(field.fields ?? [], row as FormValues, `${path}[${index}]`, true)
        }
      })
    }
  }

  visit(fields, values, '', false)
  return errors
}

/** Compile a {@link FormSchema} into a live {@link FormBuilder}. */
export function createFormBuilder(schema: FormSchema, config: FormBuilderConfig = {}): FormBuilder {
  const labelOf = (field: FieldSpec): string => field.label ?? humanize(field.name)
  const isVisible = (field: FieldSpec, values: FormValues): boolean =>
    field.when ? field.when(values) : true

  const initialValues: FormValues = {}
  const validators: Record<string, (value: unknown, values: FormValues) => string | undefined> = {}
  for (const field of schema.fields) {
    // Array (repeater) fields seed to an EMPTY array — no auto-seeded first row;
    // rows are added explicitly via the renderer's "Add" button.
    initialValues[field.name] = seedValue(field) as FormValues[string]
    if (field.required) {
      const label = labelOf(field)
      // `required` on an array field = the array must be non-empty; on a scalar
      // field = a non-empty value. A conditionally-hidden field skips its check,
      // so it can't silently block submit when the user can't even see it.
      const isMissing =
        field.type === 'array'
          ? (value: unknown) => !Array.isArray(value) || value.length === 0
          : (value: unknown) => isEmpty(value)
      validators[field.name] = (value: unknown, values: FormValues) =>
        isVisible(field, values) && isMissing(value) ? `${label} is required` : undefined
    }
  }

  const form = createFormStore<FormValues>({
    initialValues,
    validators,
    validateOnChange: config.validateOnChange ?? true,
    onSubmit: config.onSubmit,
    parse: config.parse,
    transform: config.transform,
    dependencies: config.dependencies,
    validate: async (values) => ({
      ...validateArrayFields(schema.fields, values),
      ...(config.validate ? await config.validate(values) : {}),
    }),
    ...(schema.steps ? { steps: schema.steps } : {}),
  })

  const stepCount = form.stepCount()

  const stepFields = (state: FormState<FormValues>): FieldSpec[] => {
    const step = schema.steps?.[state.currentStep]
    const stepNames = step ? new Set(step.fields) : null
    return schema.fields.filter((f) => {
      if (stepNames && !stepNames.has(f.name)) return false
      return isVisible(f, state.values)
    })
  }

  const isLastStep = (state: FormState<FormValues>): boolean =>
    !schema.steps || state.currentStep >= stepCount - 1

  return {
    form,
    fields: schema.fields,
    submitLabel: schema.submitLabel ?? 'Submit',
    labelOf,
    isVisible,
    visibleFields: (values) => schema.fields.filter((f) => isVisible(f, values)),
    stepCount,
    nextStepLabel: schema.nextStepLabel ?? 'Next',
    stepFields,
    isLastStep,
    nextStep: () => form.nextStep(),
    prevStep: () => form.prevStep(),
  }
}

/** CSS custom properties the form builder reads; overridable by the host theme. */
export const formBuilderTokens: Record<string, string> = {
  '--iris-form-gap': 'var(--iris-gap-md)',
  '--iris-form-label': 'var(--iris-foreground)',
  '--iris-form-error': 'var(--iris-danger)',
  '--iris-form-border': 'var(--iris-border)',
}

/**
 * The form-builder plugin. Pass to `<IrisProvider plugins={[formBuilderPlugin]}>`.
 * Registers the form-builder theme tokens (forms are per-instance, so no store).
 */
export const formBuilderPlugin = createPlugin({
  name: 'form-builder',
  install(registry) {
    registry.registerTokens(formBuilderTokens)
  },
})
