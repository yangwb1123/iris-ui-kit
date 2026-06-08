import { createSignal, onCleanup, For, Show, type JSX } from 'solid-js'
import { createFormBuilder, type FormSchema, type FieldSpec, type FormBuilderConfig } from '../core'
import type { FormValues } from '@iris-ui/core'

export type { FormSchema, FieldSpec } from '../core'

export interface IrisFormBuilderProps extends FormBuilderConfig {
  schema: FormSchema
  class?: string
  style?: JSX.CSSProperties
}

/**
 * Render a validated form from a declarative schema (SolidJS). Each field becomes
 * an accessible native control wired to the core form engine; required fields
 * validate inline; submit runs the schema's `onSubmit`. Themed via CSS vars.
 */
export function IrisFormBuilder(props: IrisFormBuilderProps) {
  // Create the builder ONCE (forms are per-instance; props are read once).
  const builder = createFormBuilder(props.schema, {
    onSubmit: props.onSubmit,
    validateOnChange: props.validateOnChange,
  })
  const { form, fields, submitLabel, labelOf } = builder

  const [state, setState] = createSignal(form.getState())
  onCleanup(form.subscribe(setState))

  const setValue = (field: FieldSpec, value: unknown) =>
    form.setFieldValue(field.name, value as FormValues[string])

  return (
    <form
      data-iris-form-builder=""
      class={props.class}
      style={{ display: 'grid', gap: 'var(--iris-form-gap, 16px)', ...props.style }}
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      noValidate
    >
      <For each={fields}>
        {(field) => {
          const id = `iris-fb-${field.name}`
          const type = field.type ?? 'text'
          const value = () => state().values[field.name]
          const error = () => state().errors[field.name]
          const describedBy = () => (error() ? `${id}-error` : undefined)
          return (
            <div data-iris-form-field={field.name}>
              <Show when={type !== 'checkbox'}>
                <label for={id} style={{ display: 'block', color: 'var(--iris-form-label)' }}>
                  {labelOf(field)}
                  {field.required ? ' *' : ''}
                </label>
              </Show>
              <Show when={type === 'textarea'}>
                <textarea
                  id={id}
                  value={String(value() ?? '')}
                  placeholder={field.placeholder}
                  aria-required={field.required || undefined}
                  aria-invalid={error() ? true : undefined}
                  aria-describedby={describedBy()}
                  onInput={(e) => setValue(field, e.currentTarget.value)}
                  onBlur={() => form.setFieldTouched(field.name)}
                />
              </Show>
              <Show when={type === 'select'}>
                <select
                  id={id}
                  value={String(value() ?? '')}
                  aria-required={field.required || undefined}
                  aria-invalid={error() ? true : undefined}
                  aria-describedby={describedBy()}
                  onChange={(e) => setValue(field, e.currentTarget.value)}
                  onBlur={() => form.setFieldTouched(field.name)}
                >
                  <option value="">{field.placeholder ?? 'Select…'}</option>
                  <For each={field.options ?? []}>
                    {(opt) => <option value={opt.value}>{opt.label}</option>}
                  </For>
                </select>
              </Show>
              <Show when={type === 'checkbox'}>
                <label for={id} style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={Boolean(value())}
                    aria-describedby={describedBy()}
                    onChange={(e) => setValue(field, e.currentTarget.checked)}
                    onBlur={() => form.setFieldTouched(field.name)}
                  />
                  {labelOf(field)}
                  {field.required ? ' *' : ''}
                </label>
              </Show>
              <Show when={type !== 'textarea' && type !== 'select' && type !== 'checkbox'}>
                <input
                  id={id}
                  type={type}
                  value={String(value() ?? '')}
                  placeholder={field.placeholder}
                  aria-required={field.required || undefined}
                  aria-invalid={error() ? true : undefined}
                  aria-describedby={describedBy()}
                  onInput={(e) => setValue(field, e.currentTarget.value)}
                  onBlur={() => form.setFieldTouched(field.name)}
                />
              </Show>
              <Show when={error()}>
                <div id={`${id}-error`} role="alert" style={{ color: 'var(--iris-form-error)' }}>
                  {error()}
                </div>
              </Show>
            </div>
          )
        }}
      </For>
      <button type="submit" disabled={state().isSubmitting}>
        {submitLabel}
      </button>
    </form>
  )
}
