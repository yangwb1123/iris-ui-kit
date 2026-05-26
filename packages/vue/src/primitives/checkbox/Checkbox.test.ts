import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisCheckbox } from './Checkbox'

describe('IrisCheckbox', () => {
  it('renders a native checkbox', () => {
    const wrapper = mount(IrisCheckbox)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
  })

  it('checked state sets aria-checked="true"', () => {
    const wrapper = mount(IrisCheckbox, { props: { modelValue: true } })
    expect(wrapper.find('input').attributes('aria-checked')).toBe('true')
  })

  it('unchecked state sets aria-checked="false"', () => {
    const wrapper = mount(IrisCheckbox, { props: { modelValue: false } })
    expect(wrapper.find('input').attributes('aria-checked')).toBe('false')
  })

  it('indeterminate state sets aria-checked="mixed"', () => {
    const wrapper = mount(IrisCheckbox, { props: { modelValue: 'indeterminate' } })
    expect(wrapper.find('input').attributes('aria-checked')).toBe('mixed')
    expect(wrapper.attributes('data-state')).toBe('indeterminate')
  })

  it('emits update:modelValue when toggled', async () => {
    const wrapper = mount(IrisCheckbox, { props: { modelValue: false } })
    await wrapper.find('input').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('renders an SVG check when checked', () => {
    const wrapper = mount(IrisCheckbox, { props: { modelValue: true } })
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
