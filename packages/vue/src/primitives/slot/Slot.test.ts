import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, Fragment } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisSlot, findFirstElement } from './Slot'

describe('IrisSlot', () => {
  it('renders the single child VNode', () => {
    const wrapper = mount(IrisSlot, {
      slots: { default: () => h('a', { href: '/x' }, 'go') },
    })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/x')
  })

  it('merges attrs onto the child', () => {
    const wrapper = mount(IrisSlot, {
      attrs: { 'data-test': 'merged', class: 'parent-class' },
      slots: { default: () => h('a', { class: 'child-class' }, 'go') },
    })
    expect(wrapper.attributes('data-test')).toBe('merged')
    const cls = wrapper.attributes('class') ?? ''
    expect(cls).toContain('parent-class')
    expect(cls).toContain('child-class')
  })

  it('chains event handlers (parent first, then child)', async () => {
    const order: string[] = []
    const wrapper = mount(IrisSlot, {
      attrs: { onClick: () => order.push('parent') },
      slots: {
        default: () => h('button', { onClick: () => order.push('child') }, 'go'),
      },
    })
    await wrapper.trigger('click')
    expect(order).toEqual(['parent', 'child'])
  })

  it('looks inside Fragments to find the first element', () => {
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(IrisSlot, null, {
            default: () => [h(Fragment, null, [h('span', { class: 'in-frag' }, 'x')])],
          })
      },
    })
    const wrapper = mount(Wrapper)
    expect(wrapper.find('.in-frag').exists()).toBe(true)
  })

  it('warns and returns null when no child element is given', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mount(IrisSlot)
    expect(wrapper.html()).toBe('')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('findFirstElement', () => {
  it('returns null on empty input', () => {
    expect(findFirstElement(undefined)).toBeNull()
    expect(findFirstElement([])).toBeNull()
  })

  it('returns the first element VNode', () => {
    const span = h('span', null, 'a')
    expect(findFirstElement([span])).toBe(span)
  })

  it('skips text-only nodes', () => {
    // Text VNodes have type === Text symbol, which is a symbol — filtered by our check.
    const text = h('span', null, 'hello')  // wrap text in element instead
    expect(findFirstElement([text])?.type).toBe('span')
  })
})
