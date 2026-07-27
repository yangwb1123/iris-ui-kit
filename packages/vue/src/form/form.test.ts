import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { IrisForm } from './Form'
import { useForm } from './useForm'
import { useField } from './useField'

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
