import {
  createFormStore,
  createPlugin,
  type FormState,
  type FormStore,
  type FormValues,
} from '@iris-ui/core'

export type { FormValues } from '@iris-ui/core'

/**
 * `@iris-ui/plugin-form-builder` — render a working, validated form from a
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
  /** Seed value (defaults to `false` for checkbox, `''` otherwise). */
  defaultValue?: unknown
  /**
   * Conditional visibility: the field is shown only when this returns true for
   * the current form values (e.g. `(v) => v.hasAccount === true`). A hidden
   * field is not rendered AND its `required` validator is skipped, so it never
   * silently blocks submit. Omitted = always visible.
   */
  when?: (values: FormValues) => boolean
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

/** Compile a {@link FormSchema} into a live {@link FormBuilder}. */
export function createFormBuilder(schema: FormSchema, config: FormBuilderConfig = {}): FormBuilder {
  const labelOf = (field: FieldSpec): string => field.label ?? humanize(field.name)
  const isVisible = (field: FieldSpec, values: FormValues): boolean =>
    field.when ? field.when(values) : true

  const initialValues: FormValues = {}
  const validators: Record<string, (value: unknown, values: FormValues) => string | undefined> = {}
  for (const field of schema.fields) {
    initialValues[field.name] =
      field.defaultValue ?? (field.type === 'checkbox' ? false : field.type === 'number' ? '' : '')
    if (field.required) {
      const label = labelOf(field)
      // A conditionally-hidden field skips its required check, so it can't
      // silently block submit when the user can't even see it.
      validators[field.name] = (value: unknown, values: FormValues) =>
        isVisible(field, values) && isEmpty(value) ? `${label} is required` : undefined
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
  '--iris-form-gap': 'var(--iris-space-md, 16px)',
  '--iris-form-label': 'var(--iris-color-fg, #111827)',
  '--iris-form-error': 'var(--iris-color-danger, #dc2626)',
  '--iris-form-border': 'var(--iris-color-border, #d1d5db)',
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
