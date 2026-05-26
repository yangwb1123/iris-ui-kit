import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisSwitch } from './Switch'

describe('IrisSwitch', () => {
  it('renders a checkbox with role=switch', () => {
    const wrapper = mount(IrisSwitch)
    const input = wrapper.find('input[type="checkbox"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('role')).toBe('switch')
  })

  it('reflects modelValue via aria-checked', () => {
    const off = mount(IrisSwitch, { props: { modelValue: false } })
    const on = mount(IrisSwitch, { props: { modelValue: true } })
    expect(off.find('input').attributes('aria-checked')).toBe('false')
    expect(on.find('input').attributes('aria-checked')).toBe('true')
  })

  it('emits update:modelValue on change', async () => {
    const wrapper = mount(IrisSwitch, { props: { modelValue: false } })
    await wrapper.find('input').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('emits a change event with the new value', async () => {
    const wrapper = mount(IrisSwitch)
    await wrapper.find('input').setValue(true)
    expect(wrapper.emitted('change')?.[0]).toEqual([true])
  })

  it('renders disabled', () => {
    const wrapper = mount(IrisSwitch, { props: { disabled: true } })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })

  it('reflects state via data-state attribute', () => {
    const off = mount(IrisSwitch, { props: { modelValue: false } })
    const on = mount(IrisSwitch, { props: { modelValue: true } })
    expect(off.attributes('data-state')).toBe('unchecked')
    expect(on.attributes('data-state')).toBe('checked')
  })
})
