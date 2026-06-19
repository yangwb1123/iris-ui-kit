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

  it('wizard: renders Next/Previous and advances steps on click', async () => {
    const wizard: FormSchema = {
      steps: [{ fields: ['name'] }, { fields: ['bio'] }],
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'bio', type: 'textarea' },
      ],
    }
    const wrapper = mount(IrisFormBuilder, { props: { schema: wizard } })
    expect(wrapper.find('[data-iris-form-field="name"]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-form-field="bio"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Next')
    expect(wrapper.text()).not.toContain('Submit')
    await wrapper.find('[data-iris-form-field="name"] input').setValue('Ada')
    await wrapper.find('button[type="button"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-iris-form-field="bio"]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-form-field="name"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Submit')
    expect(wrapper.text()).toContain('Previous')
    wrapper.unmount()
  })

  it('hides a conditional (when) field until its predicate passes', async () => {
    const conditional: FormSchema = {
      fields: [
        { name: 'hasAccount', type: 'checkbox' },
        { name: 'username', type: 'text', when: (v) => v.hasAccount === true },
      ],
    }
    const wrapper = mount(IrisFormBuilder, { props: { schema: conditional } })
    expect(wrapper.find('[data-iris-form-field="username"]').exists()).toBe(false)
    await wrapper.find('[data-iris-form-field="hasAccount"] input').setValue(true)
    expect(wrapper.find('[data-iris-form-field="username"]').exists()).toBe(true)
    wrapper.unmount()
  })

  // Array (repeater) field: the visible payoff of the nested-path engine. Each
  // row's sub-fields bind to `items[i].<name>`; mutations route through
  // useFieldArray so per-row state re-keys when an earlier row is removed.
  it('array field: add/remove rows and nested sub-fields re-key on remove', async () => {
    const arraySchema: FormSchema = {
      fields: [
        {
          name: 'items',
          type: 'array',
          fields: [
            { name: 'sku', required: true },
            { name: 'qty', type: 'number' },
          ],
        },
      ],
    }
    const wrapper = mount(IrisFormBuilder, { props: { schema: arraySchema } })

    expect(wrapper.find('[data-iris-fb-array="items"]').exists()).toBe(true)
    // No auto-seeded row.
    expect(wrapper.findAll('[data-iris-fb-row]')).toHaveLength(0)

    // Add → 1 row with both sub-fields bound to nested paths.
    await wrapper.find('[data-iris-fb-add="items"]').trigger('click')
    expect(wrapper.findAll('[data-iris-fb-row]')).toHaveLength(1)
    expect(wrapper.find('[data-iris-form-field="items[0].sku"] input').exists()).toBe(true)
    expect(
      wrapper.find('[data-iris-form-field="items[0].qty"] input[type="number"]').exists(),
    ).toBe(true)

    // Type into row 0's sku.
    await wrapper.find('[data-iris-form-field="items[0].sku"] input').setValue('AAA')
    expect(
      (wrapper.find('[data-iris-form-field="items[0].sku"] input').element as HTMLInputElement)
        .value,
    ).toBe('AAA')

    // Add a second row and give it a distinct value.
    await wrapper.find('[data-iris-fb-add="items"]').trigger('click')
    expect(wrapper.findAll('[data-iris-fb-row]')).toHaveLength(2)
    await wrapper.find('[data-iris-form-field="items[1].sku"] input').setValue('BBB')

    // Remove row 0 → the SECOND row's value (BBB) is now at index 0, proving the
    // nested-path re-key flowed through useFieldArray (arrayRemove).
    await wrapper.findAll('[data-iris-fb-remove]')[0]!.trigger('click')
    expect(wrapper.findAll('[data-iris-fb-row]')).toHaveLength(1)
    expect(
      (wrapper.find('[data-iris-form-field="items[0].sku"] input').element as HTMLInputElement)
        .value,
    ).toBe('BBB')
    wrapper.unmount()
  })
})
