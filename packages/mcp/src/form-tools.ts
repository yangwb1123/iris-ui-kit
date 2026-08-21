/** A field descriptor for the `generate_form` tool. */
export interface FormFieldDescriptor {
  /** Field name (e.g. 'email', 'user.name'). */
  name: string
  /** Field type. Default 'text'. */
  type?: 'text' | 'number' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox' | 'array'
  /** Human-readable label (defaults to humanized name). */
  label?: string
  /** Placeholder text. */
  placeholder?: string
  /** Mark as required. */
  required?: boolean
  /** Options for `select` type. */
  options?: { label: string; value: string }[]
  /** Default value. */
  defaultValue?: unknown
  /** Sub-fields for an array (repeater) field. */
  fields?: FormFieldDescriptor[]
  /** Array field button labels. */
  addLabel?: string
  removeLabel?: string
  itemLabel?: string
}

/** Generate a complete form-builder schema and ready-to-use framework snippets. */
export function generateFormSchema(
  fields: FormFieldDescriptor[],
  options?: { submitLabel?: string },
): { schema: Record<string, unknown>; react: string; vue: string } {
  const schema = {
    submitLabel: options?.submitLabel ?? 'Submit',
    fields: fields.map(normalizeField),
  }

  const schemaJson = JSON.stringify(schema, null, 2)
  const react = `import { IrisFormBuilder } from '@iris-ui-kit/plugin-form-builder/react'
import type { FormSchema } from '@iris-ui-kit/plugin-form-builder/react'

const schema: FormSchema = ${schemaJson}

function MyForm() {
  return (
    <IrisFormBuilder
      schema={schema}
      onSubmit={(values) => console.log(values)}
      validateOnChange
    />
  )
}`

  const vue = `<script setup lang="ts">
import { IrisFormBuilder, type FormSchema } from '@iris-ui-kit/plugin-form-builder/vue'

const schema: FormSchema = ${schemaJson}

function handleSubmit(values: Record<string, unknown>) {
  console.log(values)
}
</script>

<template>
  <IrisFormBuilder
    :schema="schema"
    :on-submit="handleSubmit"
    :validate-on-change="true"
  />
</template>`

  return { schema, react, vue }
}

function normalizeField(f: FormFieldDescriptor): Record<string, unknown> {
  const field: Record<string, unknown> = {
    name: f.name,
    type: f.type ?? 'text',
    label: f.label ?? humanize(f.name),
  }
  if (f.placeholder) field.placeholder = f.placeholder
  if (f.required) field.required = true
  if (f.defaultValue !== undefined) field.defaultValue = f.defaultValue
  if (f.options) field.options = f.options
  if (f.type === 'array' && f.fields && f.fields.length > 0) {
    field.fields = f.fields.map(normalizeField)
    if (f.addLabel) field.addLabel = f.addLabel
    if (f.removeLabel) field.removeLabel = f.removeLabel
    if (f.itemLabel) field.itemLabel = f.itemLabel
  }
  return field
}

/** Humanize a field name: 'userEmail' → 'User Email', 'user.email' → 'User Email'. */
function humanize(name: string): string {
  return name
    .replace(/[._-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase())
}
