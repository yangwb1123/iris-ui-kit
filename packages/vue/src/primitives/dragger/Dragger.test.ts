import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisDragger } from './Dragger'

describe('IrisDragger', () => {
  it('positions via translate3d using modelValue', () => {
    const wrapper = mount(IrisDragger, {
      props: { modelValue: { x: 50, y: 100 } },
      slots: { default: () => h('div', 'body') },
    })
    const style = wrapper.attributes('style') ?? ''
    expect(style).toContain('translate3d(50px, 100px, 0)')
  })

  it('initial state is "idle"', () => {
    const wrapper = mount(IrisDragger, {
      props: { modelValue: { x: 0, y: 0 } },
    })
    expect(wrapper.attributes('data-state')).toBe('idle')
  })

  it('renders the default slot', () => {
    const wrapper = mount(IrisDragger, {
      props: { modelValue: { x: 0, y: 0 } },
      slots: { default: () => h('span', { class: 'inner' }, 'x') },
    })
    expect(wrapper.find('.inner').exists()).toBe(true)
  })

  it('renders the handle slot when provided', () => {
    const wrapper = mount(IrisDragger, {
      props: { modelValue: { x: 0, y: 0 } },
      slots: {
        handle: () => h('span', { class: 'handle' }, '☰'),
        default: () => h('div', 'body'),
      },
    })
    expect(wrapper.find('.handle').exists()).toBe(true)
    expect(wrapper.find('[data-iris-dragger-handle]').exists()).toBe(true)
  })
})
