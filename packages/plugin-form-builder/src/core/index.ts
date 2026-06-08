import { createFormStore, createPlugin, type FormStore, type FormValues } from '@iris-ui/core'

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
}

export interface FormSchema {
  fields: FieldSpec[]
  /** Submit button label. Default `'Submit'`. */
  submitLabel?: string
}

export interface FormBuilderConfig {
  onSubmit?: (values: FormValues) => void | Promise<void>
  validateOnChange?: boolean
}

export interface FormBuilder {
  form: FormStore<FormValues>
  fields: FieldSpec[]
  submitLabel: string
  /** The resolved label for a field (explicit or humanized from its name). */
  labelOf(field: FieldSpec): string
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

  const initialValues: FormValues = {}
  const validators: Record<string, (value: unknown) => string | undefined> = {}
  for (const field of schema.fields) {
    initialValues[field.name] =
      field.defaultValue ?? (field.type === 'checkbox' ? false : field.type === 'number' ? '' : '')
    if (field.required) {
      const label = labelOf(field)
      validators[field.name] = (value: unknown) =>
        isEmpty(value) ? `${label} is required` : undefined
    }
  }

  const form = createFormStore<FormValues>({
    initialValues,
    validators,
    validateOnChange: config.validateOnChange ?? true,
    onSubmit: config.onSubmit,
  })

  return { form, fields: schema.fields, submitLabel: schema.submitLabel ?? 'Submit', labelOf }
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
