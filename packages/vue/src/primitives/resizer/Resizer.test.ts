import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisResizer } from './Resizer'

describe('IrisResizer', () => {
  it('renders the wrapper with given size', () => {
    const wrapper = mount(IrisResizer, {
      props: { modelValue: { width: 200, height: 120 } },
      slots: { default: () => h('div', 'content') },
    })
    const root = wrapper.find('[data-iris-resizer]')
    expect(root.element.style.width).toBe('200px')
    expect(root.element.style.height).toBe('120px')
  })

  it('renders 8 handles by default', () => {
    const wrapper = mount(IrisResizer, {
      props: { modelValue: { width: 100, height: 100 } },
    })
    expect(wrapper.findAll('[data-iris-resizer-handle]').length).toBe(8)
  })

  it('renders only the requested handles', () => {
    const wrapper = mount(IrisResizer, {
      props: { modelValue: { width: 100, height: 100 }, handles: ['bottom-right'] },
    })
    const handles = wrapper.findAll('[data-iris-resizer-handle]')
    expect(handles.length).toBe(1)
    expect(handles[0]!.attributes('data-iris-resizer-handle')).toBe('bottom-right')
  })

  it('renders the default slot content', () => {
    const wrapper = mount(IrisResizer, {
      props: { modelValue: { width: 100, height: 100 } },
      slots: { default: () => h('span', { class: 'inner' }, 'hi') },
    })
    expect(wrapper.find('.inner').exists()).toBe(true)
  })
})
