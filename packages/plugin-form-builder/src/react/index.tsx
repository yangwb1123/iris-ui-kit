import * as React from 'react'
import { createFormBuilder, type FormSchema, type FieldSpec, type FormBuilderConfig } from '../core'
import type { FormValues } from '@iris-ui/core'

export type { FormSchema, FieldSpec } from '../core'

export interface IrisFormBuilderProps extends FormBuilderConfig {
  schema: FormSchema
  className?: string
  style?: React.CSSProperties
}

/**
 * Render a validated form from a declarative schema (React). Each field becomes
 * an accessible native control wired to the core form engine; required fields
 * validate inline; submit runs the schema's `onSubmit`. Themed via CSS vars.
 */
export function IrisFormBuilder({
  schema,
  onSubmit,
  validateOnChange,
  className,
  style,
}: IrisFormBuilderProps) {
  const builderRef = React.useRef<ReturnType<typeof createFormBuilder> | null>(null)
  if (builderRef.current === null) {
    builderRef.current = createFormBuilder(schema, { onSubmit, validateOnChange })
  }
  const builder = builderRef.current
  const { form, submitLabel, labelOf } = builder
  const state = React.useSyncExternalStore(form.subscribe, form.getState, form.getState)

  const setValue = (field: FieldSpec, value: unknown) =>
    form.setFieldValue(field.name, value as FormValues[string])

  return (
    <form
      data-iris-form-builder=""
      className={className}
      style={{ display: 'grid', gap: 'var(--iris-form-gap, 16px)', ...style }}
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      noValidate
    >
      {builder.visibleFields(state.values).map((field) => {
        const id = `iris-fb-${field.name}`
        const value = state.values[field.name]
        const error = state.errors[field.name]
        const type = field.type ?? 'text'
        const describedBy = error ? `${id}-error` : undefined
        return (
          <div key={field.name} data-iris-form-field={field.name}>
            {type !== 'checkbox' && (
              <label htmlFor={id} style={{ display: 'block', color: 'var(--iris-form-label)' }}>
                {labelOf(field)}
                {field.required ? ' *' : ''}
              </label>
            )}
            {type === 'textarea' ? (
              <textarea
                id={id}
                value={String(value ?? '')}
                placeholder={field.placeholder}
                aria-required={field.required || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                onChange={(e) => setValue(field, e.target.value)}
                onBlur={() => form.setFieldTouched(field.name)}
              />
            ) : type === 'select' ? (
              <select
                id={id}
                value={String(value ?? '')}
                aria-required={field.required || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                onChange={(e) => setValue(field, e.target.value)}
                onBlur={() => form.setFieldTouched(field.name)}
              >
                <option value="">{field.placeholder ?? 'Select…'}</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : type === 'checkbox' ? (
              <label htmlFor={id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(value)}
                  aria-describedby={describedBy}
                  onChange={(e) => setValue(field, e.target.checked)}
                  onBlur={() => form.setFieldTouched(field.name)}
                />
                {labelOf(field)}
                {field.required ? ' *' : ''}
              </label>
            ) : (
              <input
                id={id}
                type={type}
                value={String(value ?? '')}
                placeholder={field.placeholder}
                aria-required={field.required || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                onChange={(e) => setValue(field, e.target.value)}
                onBlur={() => form.setFieldTouched(field.name)}
              />
            )}
            {error && (
              <div id={`${id}-error`} role="alert" style={{ color: 'var(--iris-form-error)' }}>
                {error}
              </div>
            )}
          </div>
        )
      })}
      <button type="submit" disabled={state.isSubmitting}>
        {submitLabel}
      </button>
    </form>
  )
}
