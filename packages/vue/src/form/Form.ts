import { defineComponent, h, provide, type PropType } from 'vue'
import type { FormStore, FormValues } from '@iris-ui/core'
import { FormInjectionKey } from './context'

/**
 * Provides the form store to descendant `useField` calls and wires the native
 * `<form>` submit to `handleSubmit` (with `preventDefault`). Composition:
 *
 * ```html
 * <IrisForm :form="f.form">
 *   <IrisFormField label="Email"><IrisInput v-bind="email.fieldProps.value" /></IrisFormField>
 *   <IrisButton type="submit" :disabled="f.isSubmitting.value">Save</IrisButton>
 * </IrisForm>
 * ```
 */
export const IrisForm = defineComponent({
  name: 'IrisForm',
  props: {
    /** The store from `useForm(...).form`. */
    form: {
      type: Object as PropType<FormStore<FormValues>>,
      required: true,
    },
  },
  setup(props, { slots }) {
    provide(FormInjectionKey, props.form)
    return () =>
      h(
        'form',
        {
          'data-iris-form': '',
          onSubmit: (event: Event) => {
            event.preventDefault()
            void props.form.handleSubmit()
          },
        },
        slots.default?.(),
      )
  },
})
