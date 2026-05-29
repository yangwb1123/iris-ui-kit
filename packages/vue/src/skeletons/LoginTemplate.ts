import { defineComponent, h, ref } from 'vue'
import { IrisStack } from '../layouts/Stack'
import { IrisContainer } from '../layouts/Container'
import { IrisInput } from '../primitives/input/Input'
import { IrisPasswordInput } from '../primitives/password-input/PasswordInput'
import { IrisCheckbox } from '../primitives/checkbox/Checkbox'
import { IrisButton } from '../primitives/button/Button'
import { IrisFormField } from '../primitives/form-field/FormField'
import { IrisAlert } from '../primitives/alert/Alert'
import { IrisDivider } from '../primitives/divider/Divider'

export interface IrisLoginSubmitPayload {
  email: string
  password: string
  remember: boolean
}

/**
 * Layer 4 system skeleton: a centered login page using only Iris primitives.
 * Demonstrates the recommended composition pattern (Container + Stack +
 * FormField wrappers) for forms.
 *
 * The template is opinionated about layout and a11y; data binding is left to
 * the consumer via the `submit` event + slot props.
 */
export const IrisLoginTemplate = defineComponent({
  name: 'IrisLoginTemplate',
  inheritAttrs: false,
  props: {
    title: { type: String, default: 'Sign in' },
    description: { type: String, default: '' },
    /** Show "Remember me" checkbox. */
    showRemember: { type: Boolean, default: true },
    /** Error message shown above the form. */
    error: { type: String, default: '' },
    submitLabel: { type: String, default: 'Sign in' },
    /** Disable the entire form (e.g. while a request is pending). */
    loading: { type: Boolean, default: false },
  },
  emits: {
    submit: (_payload: IrisLoginSubmitPayload) => true,
  },
  setup(props, { attrs, slots, emit }) {
    const email = ref('')
    const password = ref('')
    const remember = ref(false)

    const onSubmit = (event: Event) => {
      event.preventDefault()
      emit('submit', {
        email: email.value,
        password: password.value,
        remember: remember.value,
      })
    }

    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-iris-login-template': '',
          style: {
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--iris-background)',
            color: 'var(--iris-foreground)',
            padding: '24px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        h(IrisContainer, { maxWidth: '420px', padding: 0 }, () => [
          h(
            'form',
            {
              onSubmit,
              'data-iris-login-form': '',
              style: {
                background: 'var(--iris-surface)',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-lg, 8px)',
                padding: '32px',
                boxShadow: '0 6px 20px -8px rgba(0, 0, 0, 0.16)',
              },
            },
            [
              h(IrisStack, { spacing: 'lg' }, () => [
                slots.header
                  ? slots.header()
                  : h('div', { style: { textAlign: 'center' } }, [
                      h(
                        'h1',
                        {
                          style: {
                            margin: '0 0 4px 0',
                            fontSize: '22px',
                            fontWeight: '700',
                          },
                        },
                        props.title,
                      ),
                      props.description
                        ? h(
                            'p',
                            {
                              style: {
                                margin: '0',
                                color: 'var(--iris-muted)',
                                fontSize: '14px',
                              },
                            },
                            props.description,
                          )
                        : null,
                    ]),
                props.error ? h(IrisAlert, { tone: 'danger', title: props.error }) : null,
                h(IrisFormField, { label: 'Email', required: true }, () =>
                  h(IrisInput, {
                    type: 'email',
                    modelValue: email.value,
                    'onUpdate:modelValue': (v: string) => (email.value = v),
                    placeholder: 'you@example.com',
                    disabled: props.loading,
                    autocomplete: 'email',
                  } as Record<string, unknown>),
                ),
                h(IrisFormField, { label: 'Password', required: true }, () =>
                  h(IrisPasswordInput, {
                    modelValue: password.value,
                    'onUpdate:modelValue': (v: string) => (password.value = v),
                    placeholder: 'Enter your password',
                    disabled: props.loading,
                    autocomplete: 'current-password',
                  } as Record<string, unknown>),
                ),
                props.showRemember
                  ? h(
                      'div',
                      {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        },
                      },
                      [
                        h(
                          IrisCheckbox,
                          {
                            modelValue: remember.value,
                            'onUpdate:modelValue': (v: boolean | 'indeterminate') => {
                              remember.value = v === true
                            },
                            disabled: props.loading,
                          } as Record<string, unknown>,
                          () => 'Remember me',
                        ),
                        slots.forgot ? slots.forgot() : null,
                      ],
                    )
                  : null,
                h(
                  IrisButton,
                  {
                    type: 'submit',
                    variant: 'solid',
                    loading: props.loading,
                    style: { width: '100%' },
                  } as Record<string, unknown>,
                  () => props.submitLabel,
                ),
                slots.footer
                  ? h('div', null, [h(IrisDivider, { spacing: 'md', label: 'or' }), slots.footer()])
                  : null,
              ]),
            ],
          ),
        ]),
      )
  },
})
