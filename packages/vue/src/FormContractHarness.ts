import { defineComponent, h } from 'vue'
import { IrisForm, useForm, useField } from './form'
import type { FormStore, FormValues } from '@iris-ui/core'

/**
 * A field that binds to the `'name'` key on the parent `<IrisForm>` store.
 * Uses a native `<input>` with the expected data-* attributes so the shared
 * form contract scenario can locate it.
 */
const NameField = defineComponent({
  name: 'NameField',
  setup() {
    const field = useField<string>('name')
    return () =>
      h('div', { 'data-iris-form-field': '' }, [
        h('input', {
          'aria-label': 'name',
          value: field.value.value,
          onInput: (e: Event) => field.setValue((e.target as HTMLInputElement).value),
          onBlur: () => field.setTouched(true),
          'data-iris-input': '',
        }),
        field.error.value ? h('span', { 'data-iris-form-error': '' }, field.error.value) : null,
      ])
  },
})

/**
 * Harness for the shared Form contract scenario.
 * Renders an `<IrisForm>` with a single required field.
 */
export const FormContractHarness = defineComponent({
  name: 'FormContractHarness',
  setup() {
    const form = useForm({
      initialValues: { name: '' },
      validators: { name: (v: string) => (v ? undefined : 'Required') },
    })
    return () =>
      h(
        IrisForm,
        { form: form.form as unknown as FormStore<FormValues> },
        {
          default: () => h(NameField),
        },
      )
  },
})
