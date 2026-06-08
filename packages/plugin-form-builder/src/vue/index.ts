import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  shallowRef,
  type PropType,
  type VNode,
} from 'vue'
import { createFormBuilder, type FormSchema, type FieldSpec, type FormBuilderConfig } from '../core'
import type { FormValues } from '@iris-ui/core'

export type { FormSchema, FieldSpec } from '../core'

/**
 * Render a validated form from a declarative schema (Vue, render-function
 * authored to match the `@iris-ui/vue` convention). Each field becomes an
 * accessible native control wired to the framework-agnostic core form engine;
 * required fields validate inline; submit runs the schema's `onSubmit`. Themed
 * via CSS vars. No new form logic — it draws the compiled {@link createFormBuilder}.
 */
export const IrisFormBuilder = defineComponent({
  name: 'IrisFormBuilder',
  props: {
    schema: { type: Object as PropType<FormSchema>, required: true },
    onSubmit: {
      type: Function as PropType<FormBuilderConfig['onSubmit']>,
      default: undefined,
    },
    validateOnChange: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  },
  setup(props) {
    // Create the builder ONCE (the form engine owns its own state); the props
    // are read at construction, exactly like the React ref-init pattern.
    const builder = createFormBuilder(props.schema, {
      onSubmit: props.onSubmit,
      validateOnChange: props.validateOnChange,
    })
    const { form, fields, submitLabel, labelOf } = builder

    const state = shallowRef(form.getState())
    let unsub = () => {}
    onMounted(() => {
      unsub = form.subscribe((s) => {
        state.value = s
      })
    })
    onUnmounted(() => unsub())

    const setValue = (field: FieldSpec, value: unknown) =>
      form.setFieldValue(field.name, value as FormValues[string])

    return () => {
      const fieldNodes: VNode[] = fields.map((field) => {
        const id = `iris-fb-${field.name}`
        const value = state.value.values[field.name]
        const error = state.value.errors[field.name]
        const type = field.type ?? 'text'
        const describedBy = error ? `${id}-error` : undefined

        let control: VNode
        if (type === 'textarea') {
          control = h('textarea', {
            id,
            value: String(value ?? ''),
            placeholder: field.placeholder,
            'aria-required': field.required || undefined,
            'aria-invalid': error ? true : undefined,
            'aria-describedby': describedBy,
            onInput: (e: Event) => setValue(field, (e.target as HTMLTextAreaElement).value),
            onBlur: () => form.setFieldTouched(field.name),
          })
        } else if (type === 'select') {
          control = h(
            'select',
            {
              id,
              value: String(value ?? ''),
              'aria-required': field.required || undefined,
              'aria-invalid': error ? true : undefined,
              'aria-describedby': describedBy,
              onChange: (e: Event) => setValue(field, (e.target as HTMLSelectElement).value),
              onBlur: () => form.setFieldTouched(field.name),
            },
            [
              h('option', { value: '' }, field.placeholder ?? 'Select…'),
              ...(field.options ?? []).map((opt) =>
                h('option', { key: opt.value, value: opt.value }, opt.label),
              ),
            ],
          )
        } else if (type === 'checkbox') {
          control = h(
            'label',
            { for: id, style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            [
              h('input', {
                id,
                type: 'checkbox',
                checked: Boolean(value),
                'aria-describedby': describedBy,
                onChange: (e: Event) => setValue(field, (e.target as HTMLInputElement).checked),
                onBlur: () => form.setFieldTouched(field.name),
              }),
              `${labelOf(field)}${field.required ? ' *' : ''}`,
            ],
          )
        } else {
          control = h('input', {
            id,
            type,
            value: String(value ?? ''),
            placeholder: field.placeholder,
            'aria-required': field.required || undefined,
            'aria-invalid': error ? true : undefined,
            'aria-describedby': describedBy,
            onInput: (e: Event) => setValue(field, (e.target as HTMLInputElement).value),
            onBlur: () => form.setFieldTouched(field.name),
          })
        }

        const children: VNode[] = []
        if (type !== 'checkbox') {
          children.push(
            h(
              'label',
              { for: id, style: { display: 'block', color: 'var(--iris-form-label)' } },
              `${labelOf(field)}${field.required ? ' *' : ''}`,
            ),
          )
        }
        children.push(control)
        if (error) {
          children.push(
            h(
              'div',
              { id: `${id}-error`, role: 'alert', style: { color: 'var(--iris-form-error)' } },
              error,
            ),
          )
        }

        return h('div', { key: field.name, 'data-iris-form-field': field.name }, children)
      })

      return h(
        'form',
        {
          'data-iris-form-builder': '',
          style: { display: 'grid', gap: 'var(--iris-form-gap, 16px)' },
          novalidate: true,
          onSubmit: (e: Event) => {
            e.preventDefault()
            void form.handleSubmit()
          },
        },
        [
          ...fieldNodes,
          h('button', { type: 'submit', disabled: state.value.isSubmitting }, submitLabel),
        ],
      )
    }
  },
})
