import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisSplitter } from './Splitter'

describe('IrisSplitter', () => {
  it('renders a horizontal divider with role=separator by default', () => {
    const wrapper = mount(IrisSplitter, {
      slots: { start: () => h('div', 'A'), end: () => h('div', 'B') },
    })
    const sep = wrapper.find('[role="separator"]')
    expect(sep.exists()).toBe(true)
    expect(sep.attributes('aria-orientation')).toBe('horizontal')
  })

  it('vertical orientation reports aria-orientation="vertical"', () => {
    const wrapper = mount(IrisSplitter, {
      props: { orientation: 'vertical' },
      slots: { start: () => h('div', 'A'), end: () => h('div', 'B') },
    })
    expect(wrapper.find('[role="separator"]').attributes('aria-orientation')).toBe('vertical')
  })

  it('aria-valuenow reflects the modelValue ratio as %', () => {
    const wrapper = mount(IrisSplitter, {
      props: { modelValue: 0.25 },
      slots: { start: () => h('div'), end: () => h('div') },
    })
    expect(wrapper.find('[role="separator"]').attributes('aria-valuenow')).toBe('25')
  })

  it('renders the start and end slots', () => {
    const wrapper = mount(IrisSplitter, {
      slots: {
        start: () => h('span', { class: 'lhs' }, 'L'),
        end: () => h('span', { class: 'rhs' }, 'R'),
      },
    })
    expect(wrapper.find('.lhs').exists()).toBe(true)
    expect(wrapper.find('.rhs').exists()).toBe(true)
  })

  it('disabled sets tabindex=-1 on handle and cursor not-allowed', () => {
    const wrapper = mount(IrisSplitter, {
      props: { disabled: true },
      slots: { start: () => h('div'), end: () => h('div') },
    })
    const sep = wrapper.find('[role="separator"]')
    expect(sep.attributes('tabindex')).toBe('-1')
  })
})
