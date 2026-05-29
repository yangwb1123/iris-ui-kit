import { defineComponent, h, provide, ref, type PropType } from 'vue'
import type { FormStore, FormValues } from '@iris-ui/core'
import { FormInjectionKey } from './context'

/** Focus (and best-effort scroll to) the first errored named control in DOM order. */
function focusFirstError(
  formEl: HTMLElement | null,
  errors: Record<string, string | undefined>,
): void {
  if (!formEl) return
  const keys = Object.keys(errors)
  if (keys.length === 0) return
  const controls = formEl.querySelectorAll<HTMLElement>(
    'input[name], select[name], textarea[name], [data-iris-field]',
  )
  for (const el of Array.from(controls)) {
    const name = el.getAttribute('name') ?? el.getAttribute('data-iris-field')
    if (name && keys.includes(name)) {
      el.focus()
      try {
        el.scrollIntoView({ block: 'center' })
      } catch {
        /* scrollIntoView is unavailable in jsdom — focus is the contract */
      }
      return
    }
  }
}

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
    const formRef = ref<HTMLElement | null>(null)
    return () =>
      h(
        'form',
        {
          ref: formRef,
          'data-iris-form': '',
          onSubmit: (event: Event) => {
            event.preventDefault()
            // On a failed submit, move focus to the first errored field (a11y).
            void props.form
              .handleSubmit()
              .then(() => focusFirstError(formRef.value, props.form.getState().errors))
          },
        },
        slots.default?.(),
      )
  },
})
