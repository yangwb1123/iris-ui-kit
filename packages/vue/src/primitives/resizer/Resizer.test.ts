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

  it('provides named keyboard handles without regressing pointer dragging', async () => {
    const wrapper = mount(IrisResizer, {
      props: {
        modelValue: { width: 100, height: 100 },
        handles: ['right'],
        maxWidth: 300,
      },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    const handle = wrapper.find('[data-iris-resizer-handle=right]')

    expect(handle.element.tagName).toBe('BUTTON')
    expect(handle.attributes('aria-label')).toBe('Resize right')
    ;(handle.element as HTMLElement).focus()
    expect(document.activeElement).toBe(handle.element)

    await handle.trigger('pointerdown', {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    })
    await handle.trigger('pointermove', { pointerId: 1, clientX: 120, clientY: 100 })
    await handle.trigger('pointerup', { pointerId: 1, clientX: 120, clientY: 100 })
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0]).toEqual({
      width: 120,
      height: 100,
    })

    await handle.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0]).toEqual({
      width: 110,
      height: 100,
    })
    await handle.trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0]).toEqual({
      width: 40,
      height: 100,
    })
    await handle.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0]).toEqual({
      width: 300,
      height: 100,
    })
    wrapper.unmount()
  })
})
