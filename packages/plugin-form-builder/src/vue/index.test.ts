import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { IrisFormBuilder } from './index'
import type { FormSchema } from '../core'

const schema: FormSchema = {
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'bio', type: 'textarea' },
    { name: 'role', type: 'select', options: [{ label: 'Admin', value: 'a' }] },
    { name: 'agree', type: 'checkbox' },
  ],
  submitLabel: 'Save',
}

describe('IrisFormBuilder (vue)', () => {
  it('renders a field control per schema entry + a submit button', () => {
    const wrapper = mount(IrisFormBuilder, { props: { schema } })
    expect(wrapper.find('[data-iris-form-field="name"] input').exists()).toBe(true)
    expect(wrapper.find('[data-iris-form-field="bio"] textarea').exists()).toBe(true)
    expect(wrapper.find('[data-iris-form-field="role"] select').exists()).toBe(true)
    expect(wrapper.find('[data-iris-form-field="agree"] input[type="checkbox"]').exists()).toBe(
      true,
    )
    expect(wrapper.text()).toContain('Save')
    wrapper.unmount()
  })

  it('shows a required error on submit and blocks onSubmit', async () => {
    const onSubmit = vi.fn()
    const wrapper = mount(IrisFormBuilder, { props: { schema, onSubmit } })
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Name is required')
    expect(onSubmit).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('submits values when valid', async () => {
    const onSubmit = vi.fn()
    const wrapper = mount(IrisFormBuilder, { props: { schema, onSubmit } })
    const input = wrapper.find('[data-iris-form-field="name"] input')
    await input.setValue('Ada')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(onSubmit).toHaveBeenCalled()
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ada' }))
    wrapper.unmount()
  })
})
