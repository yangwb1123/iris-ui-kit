import {
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  provide,
  shallowRef,
  type PropType,
  type VNode,
} from 'vue'
import { FormInjectionKey, useField, useFieldArray } from '@iris-ui/vue/form'
import type { FormStore, FormValues } from '@iris-ui/core'
import {
  arrayRowDefaults,
  createFormBuilder,
  type FormSchema,
  type FieldSpec,
  type FormBuilderConfig,
} from '../core'

export type { FormSchema, FieldSpec } from '../core'

/** Resolved label for a field (explicit, else humanized from its name). */
function humanize(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
const labelOf = (field: FieldSpec): string => field.label ?? humanize(field.name)

/**
 * The full path a field binds to: a top-level field is just its `name`; a
 * sub-field inside an array row is `${prefix}.${name}` where `prefix` is the row
 * path (`items[2]`). `useField` parses both into the same canonical key.
 */
const pathOf = (field: FieldSpec, prefix?: string): string =>
  prefix ? `${prefix}.${field.name}` : field.name

/**
 * A single scalar control (text/number/email/password/textarea/select/checkbox).
 * Binds through `@iris-ui/vue/form`'s `useField`, keyed by CANONICAL PATH — so a
 * sub-field nested under an array row (`items[2].sku`) tracks its own
 * error/touched/dirty independently of its siblings, and re-keys on remove/move.
 */
const ScalarField = defineComponent({
  name: 'IrisFormBuilderScalarField',
  props: {
    field: { type: Object as PropType<FieldSpec>, required: true },
    prefix: { type: String as PropType<string | undefined>, default: undefined },
  },
  setup(props) {
    const path = pathOf(props.field, props.prefix)
    const f = useField<unknown>(path)
    const id = `iris-fb-${path}`

    return () => {
      const field = props.field
      const type = field.type ?? 'text'
      const value = f.value.value
      const error = f.error.value
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
          onInput: (e: Event) => f.setValue((e.target as HTMLTextAreaElement).value),
          onBlur: () => f.setTouched(),
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
            onChange: (e: Event) => f.setValue((e.target as HTMLSelectElement).value),
            onBlur: () => f.setTouched(),
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
              onChange: (e: Event) => f.setValue((e.target as HTMLInputElement).checked),
              onBlur: () => f.setTouched(),
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
          onInput: (e: Event) => f.setValue((e.target as HTMLInputElement).value),
          onBlur: () => f.setTouched(),
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

      return h('div', { 'data-iris-form-field': path }, children)
    }
  },
})

/**
 * An `array` (repeater) field: zero rows initially, an "Add" button appends a row
 * built from {@link arrayRowDefaults}, and each row renders the sub-fields bound
 * to their nested path plus a "Remove" button. Mutations route through
 * `useFieldArray`, which re-keys per-row state across remove/move.
 */
const ArrayField = defineComponent({
  name: 'IrisFormBuilderArrayField',
  props: {
    field: { type: Object as PropType<FieldSpec>, required: true },
  },
  setup(props) {
    const arr = useFieldArray<Record<string, unknown>>(props.field.name)
    const f = useField<unknown>(props.field.name)
    const id = `iris-fb-${props.field.name}`

    return () => {
      const field = props.field
      const subFields = field.fields ?? []
      const error = f.error.value

      const rows: VNode[] = arr.fields.value.map((_, index) => {
        const prefix = `${field.name}[${index}]`
        const rowChildren: VNode[] = []
        if (field.itemLabel) {
          rowChildren.push(
            h('div', { 'data-iris-fb-item-label': '' }, `${field.itemLabel} ${index + 1}`),
          )
        }
        for (const sub of subFields) {
          rowChildren.push(h(ScalarField, { key: sub.name, field: sub, prefix }))
        }
        rowChildren.push(
          h(
            'button',
            { type: 'button', 'data-iris-fb-remove': index, onClick: () => arr.remove(index) },
            field.removeLabel ?? 'Remove',
          ),
        )
        return h('div', { key: index, 'data-iris-fb-row': index }, rowChildren)
      })

      const children: VNode[] = [
        h(
          'label',
          { style: { display: 'block', color: 'var(--iris-form-label)' } },
          `${labelOf(field)}${field.required ? ' *' : ''}`,
        ),
        h('div', { 'data-iris-fb-array': field.name }, rows),
        h(
          'button',
          {
            type: 'button',
            'data-iris-fb-add': field.name,
            onClick: () => arr.push(arrayRowDefaults(field)),
          },
          field.addLabel ?? 'Add',
        ),
      ]
      if (error) {
        children.push(
          h(
            'div',
            { id: `${id}-error`, role: 'alert', style: { color: 'var(--iris-form-error)' } },
            error,
          ),
        )
      }

      return h('div', { 'data-iris-form-field': field.name }, children)
    }
  },
})

/**
 * Render one schema field — dispatch to {@link ArrayField} for repeaters, else a
 * {@link ScalarField}.
 */
function renderField(field: FieldSpec): VNode {
  return field.type === 'array'
    ? h(ArrayField, { key: field.name, field })
    : h(ScalarField, { key: field.name, field })
}

/**
 * Render a validated form from a declarative schema (Vue, render-function
 * authored to match the `@iris-ui/vue` convention). Each field becomes an
 * accessible native control wired to the framework-agnostic core form engine;
 * required fields validate inline; submit runs the schema's `onSubmit`. Themed
 * via CSS vars. No new form logic — it draws the compiled {@link createFormBuilder}.
 *
 * The builder's `createFormStore` is `provide`d through `FormInjectionKey` so each
 * field's `useField` / `useFieldArray` (from `@iris-ui/vue/form`) resolves it.
 * This is what lets an `array` (repeater) field bind its per-row sub-fields to
 * nested paths (`items[2].sku`), with per-row state that re-keys on remove/move.
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
    parse: {
      type: Function as PropType<FormBuilderConfig['parse']>,
      default: undefined,
    },
    transform: {
      type: Function as PropType<FormBuilderConfig['transform']>,
      default: undefined,
    },
    dependencies: {
      type: Object as PropType<FormBuilderConfig['dependencies']>,
      default: undefined,
    },
  },
  setup(props) {
    // Create the builder ONCE (the form engine owns its own state); the props
    // are read at construction, exactly like the React ref-init pattern.
    const builder = createFormBuilder(props.schema, {
      onSubmit: props.onSubmit,
      validateOnChange: props.validateOnChange,
      parse: props.parse,
      transform: props.transform,
      dependencies: props.dependencies,
    })
    const {
      form,
      submitLabel,
      stepCount,
      nextStepLabel,
      stepFields,
      isLastStep,
      nextStep,
      prevStep,
    } = builder

    // Expose the builder's store so descendant fields' `useField` /
    // `useFieldArray` (from `@iris-ui/vue/form`) bind to it without prop drilling.
    provide(FormInjectionKey, form as unknown as FormStore<FormValues>)

    const state = shallowRef(form.getState())
    let unsub = () => {}
    onMounted(() => {
      unsub = form.subscribe((s) => {
        state.value = s
      })
    })
    onUnmounted(() => unsub())

    return () =>
      h(
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
          ...stepFields(state.value).map((field) => renderField(field)),
          isLastStep(state.value)
            ? h('button', { type: 'submit', disabled: state.value.isSubmitting }, submitLabel)
            : h('button', { type: 'button', onClick: () => void nextStep() }, nextStepLabel),
          stepCount > 1 && state.value.currentStep > 0
            ? h('button', { type: 'button', onClick: prevStep }, 'Previous')
            : null,
        ],
      )
  },
})
