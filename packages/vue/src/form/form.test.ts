import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { defineComponent, h, nextTick, type ComputedRef, type Ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import type { FormState } from '@iris-ui-kit/core'
import { IrisForm } from './Form'
import { useForm } from './useForm'
import { useField } from './useField'
import { useFieldArray } from './useFieldArray'

const NameField = defineComponent({
  setup() {
    const field = useField<string>('name')
    return () =>
      h('div', null, [
        h('input', {
          'aria-label': 'name',
          value: field.value.value,
          onInput: (e: Event) => field.setValue((e.target as HTMLInputElement).value),
          onBlur: () => field.setTouched(true),
        }),
        field.error.value ? h('span', { role: 'alert' }, field.error.value) : null,
        h('span', { class: 'touched' }, String(field.touched.value)),
        h('span', { class: 'dirty' }, String(field.dirty.value)),
      ])
  },
})

function makeForm(onSubmit?: (v: { name: string }) => void) {
  return defineComponent({
    setup() {
      const form = useForm({
        initialValues: { name: '' },
        validators: { name: (v) => (v ? undefined : 'Required') },
        onSubmit,
      })
      return () =>
        h(
          IrisForm,
          { form: form.form },
          {
            default: () => [
              h(NameField),
              h('span', { class: 'submitting' }, String(form.isSubmitting.value)),
              h('span', { class: 'valid' }, String(form.isValid.value)),
              h('button', { type: 'submit' }, 'Save'),
              h('button', { type: 'button', class: 'reset', onClick: () => form.reset() }, 'Reset'),
            ],
          },
        )
    },
  })
}

describe('@iris-ui-kit/vue useForm / useField', () => {
  it('renders the initial field value', () => {
    const wrapper = mount(makeForm())
    expect(wrapper.find<HTMLInputElement>('input').element.value).toBe('')
  })

  it('updates the value on change and tracks dirty', async () => {
    const wrapper = mount(makeForm())
    await wrapper.find('input').setValue('ann')
    expect(wrapper.find<HTMLInputElement>('input').element.value).toBe('ann')
    expect(wrapper.find('.dirty').text()).toBe('true')
  })

  it('validates on change and surfaces the error', async () => {
    const wrapper = mount(makeForm())
    await wrapper.find('input').setValue('ann')
    await wrapper.find('input').setValue('')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('[role="alert"]').text()).toBe('Required')
  })

  it('marks the field touched on blur', async () => {
    const wrapper = mount(makeForm())
    await wrapper.find('input').trigger('blur')
    expect(wrapper.find('.touched').text()).toBe('true')
  })

  it('blocks submit and shows errors when invalid', async () => {
    const onSubmit = vi.fn()
    const wrapper = mount(makeForm(onSubmit))
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('Required')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with values when valid', async () => {
    const onSubmit = vi.fn()
    const wrapper = mount(makeForm(onSubmit))
    await wrapper.find('input').setValue('ann')
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(onSubmit).toHaveBeenCalledWith({ name: 'ann' })
  })

  it('reset restores the initial value', async () => {
    const wrapper = mount(makeForm())
    await wrapper.find('input').setValue('ann')
    expect(wrapper.find<HTMLInputElement>('input').element.value).toBe('ann')
    await wrapper.find('.reset').trigger('click')
    await flushPromises()
    expect(wrapper.find<HTMLInputElement>('input').element.value).toBe('')
    expect(wrapper.find('.dirty').text()).toBe('false')
  })

  it('useField throws outside an <IrisForm>', () => {
    const Bad = defineComponent({
      setup() {
        useField('x')
        return () => h('div')
      },
    })
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => mount(Bad)).toThrow(/within an <IrisForm>/)
    spy.mockRestore()
    errSpy.mockRestore()
  })

  it('typing in one field does not re-render another field (per-field slice subscriptions)', async () => {
    let rendersA = 0
    let rendersB = 0
    let formApi!: ReturnType<typeof useForm<{ name: string; email: string }>>

    const FieldA = defineComponent({
      setup() {
        const field = useField<string>('name')
        return () => {
          rendersA++
          return h('input', {
            'aria-label': 'a',
            value: field.value.value,
            onInput: (e: Event) => field.setValue((e.target as HTMLInputElement).value),
          })
        }
      },
    })
    const FieldB = defineComponent({
      setup() {
        const field = useField<string>('email')
        return () => {
          rendersB++
          return h('input', {
            'aria-label': 'b',
            value: field.value.value,
            onInput: (e: Event) => field.setValue((e.target as HTMLInputElement).value),
          })
        }
      },
    })

    // Harness render reads NO reactive form state — it cannot propagate its own
    // re-renders to the fields (children re-render only on their own deps).
    const Harness = defineComponent({
      setup() {
        const form = useForm({ initialValues: { name: '', email: '' } })
        formApi = form
        return () => h(IrisForm, { form: form.form }, { default: () => [h(FieldA), h(FieldB)] })
      },
    })
    const wrapper = mount(Harness)
    await nextTick()
    expect(rendersA).toBe(1)
    expect(rendersB).toBe(1)

    // Type into field B first — A must not re-render (the symmetric half).
    await wrapper.find('input[aria-label="b"]').setValue('b@x.com')
    await nextTick()
    expect(rendersA).toBe(1)
    expect(rendersB).toBe(2)
    const rendersBBeforeTypingA = rendersB

    // Type into field A — B's render must NOT be re-invoked by A's keystroke
    // (only B's own slice moved); A itself re-renders (sanity).
    await wrapper.find('input[aria-label="a"]').setValue('ann')
    await nextTick()
    expect(rendersA).toBe(2)
    expect(rendersB).toBe(rendersBBeforeTypingA)

    // B's value stays current in the DOM and in the store.
    expect(
      (wrapper.find<HTMLInputElement>('input[aria-label="b"]').element as HTMLInputElement).value,
    ).toBe('b@x.com')
    expect(formApi.form.getState().values.email).toBe('b@x.com')
  })

  it('exposes the published member types unchanged (compile-time pins)', () => {
    // Type-level indexing (runtime no-ops): pins the published d.ts contract so
    // a future edit that breaks assignability fails both `typecheck` and `test`.
    expectTypeOf<
      ReturnType<typeof useForm<{ name: string; email: string }>>['state']
    >().toEqualTypeOf<Ref<FormState<{ name: string; email: string }>>>()
    expectTypeOf<ReturnType<typeof useField<string>>['value']>().toEqualTypeOf<
      ComputedRef<string>
    >()
    expectTypeOf<ReturnType<typeof useField<string>>['error']>().toEqualTypeOf<
      ComputedRef<string | undefined>
    >()
    expectTypeOf<ReturnType<typeof useField<string>>['touched']>().toEqualTypeOf<
      ComputedRef<boolean>
    >()
    expectTypeOf<ReturnType<typeof useFieldArray<string>>['fields']>().toEqualTypeOf<
      ComputedRef<string[]>
    >()
  })
})

describe('@iris-ui-kit/vue IrisForm focus-first-error', () => {
  // useField must run inside <IrisForm> (descendant), so fields live in a child.
  const Fields = defineComponent({
    setup() {
      const email = useField<string>('email')
      const name = useField<string>('name')
      return () => [
        h('input', {
          name: 'email',
          value: email.value.value,
          onInput: (e: Event) => email.setValue((e.target as HTMLInputElement).value),
        }),
        h('input', {
          name: 'name',
          value: name.value.value,
          onInput: (e: Event) => name.setValue((e.target as HTMLInputElement).value),
        }),
        h('button', { type: 'submit' }, 'Save'),
      ]
    },
  })

  it('focuses the first errored field on invalid submit', async () => {
    const Probe = defineComponent({
      setup() {
        const form = useForm({
          initialValues: { email: '', name: '' },
          validators: {
            email: (v) => (v ? undefined : 'Required'),
            name: (v) => (v ? undefined : 'Required'),
          },
        })
        return () => h(IrisForm, { form: form.form }, { default: () => h(Fields) })
      },
    })
    const wrapper = mount(Probe, { attachTo: document.body })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.find('input[name="email"]').element)
    wrapper.unmount()
  })
})
