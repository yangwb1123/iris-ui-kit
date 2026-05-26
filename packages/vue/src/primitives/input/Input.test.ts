import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisInput } from './Input'

describe('IrisInput', () => {
  it('renders a native <input>', () => {
    const wrapper = mount(IrisInput)
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('binds value via modelValue', () => {
    const wrapper = mount(IrisInput, { props: { modelValue: 'hello' } })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('hello')
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(IrisInput)
    await wrapper.find('input').setValue('typed')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['typed'])
  })

  it('forwards the `type` prop to the native input', () => {
    const wrapper = mount(IrisInput, { props: { type: 'password' } })
    expect(wrapper.find('input').attributes('type')).toBe('password')
  })

  it('sets disabled and aria-invalid attributes', () => {
    const wrapper = mount(IrisInput, { props: { disabled: true, invalid: true } })
    const input = wrapper.find('input')
    expect(input.attributes('disabled')).toBeDefined()
    expect(input.attributes('aria-invalid')).toBe('true')
  })

  it('renders prefix and suffix slots', () => {
    const wrapper = mount(IrisInput, {
      slots: {
        prefix: () => h('i', { class: 'pre' }, 'P'),
        suffix: () => h('i', { class: 'suf' }, 'S'),
      },
    })
    expect(wrapper.find('.pre').exists()).toBe(true)
    expect(wrapper.find('.suf').exists()).toBe(true)
  })

  it('emits focus and blur', async () => {
    const wrapper = mount(IrisInput)
    await wrapper.find('input').trigger('focus')
    expect(wrapper.emitted('focus')).toBeDefined()
    await wrapper.find('input').trigger('blur')
    expect(wrapper.emitted('blur')).toBeDefined()
  })
})
