import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisDragger } from './Dragger'

function makePointerEvent(type: string, init: PointerEventInit = {}): Event {
  const PointerCtor = (globalThis as Record<string, unknown>).PointerEvent
  if (typeof PointerCtor === 'function') {
    return new (PointerCtor as new (type: string, init?: EventInit) => Event)(type, {
      bubbles: true,
      ...init,
    })
  }
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, {
    button: init.button ?? 0,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    pointerId: init.pointerId ?? 1,
  })
  return event
}

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

  it('moves its transform when dragged without modelValue', async () => {
    const wrapper = mount(IrisDragger)
    await nextTick()
    const root = wrapper.element as HTMLElement

    root.dispatchEvent(makePointerEvent('pointerdown', { clientX: 10, clientY: 20 }))
    root.dispatchEvent(makePointerEvent('pointermove', { clientX: 35, clientY: 55 }))
    await nextTick()

    expect(root.style.transform).toContain('translate3d(25px, 35px, 0)')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ x: 25, y: 35 }])
  })

  it('leaves the transform to the parent in controlled mode', async () => {
    const wrapper = mount(IrisDragger, {
      props: { modelValue: { x: 10, y: 20 } },
    })
    await nextTick()
    const root = wrapper.element as HTMLElement

    root.dispatchEvent(makePointerEvent('pointerdown', { clientX: 100, clientY: 200 }))
    root.dispatchEvent(makePointerEvent('pointermove', { clientX: 125, clientY: 235 }))
    await nextTick()

    expect(root.style.transform).toContain('translate3d(10px, 20px, 0)')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ x: 35, y: 55 }])

    await wrapper.setProps({ modelValue: { x: 35, y: 55 } })
    expect(root.style.transform).toContain('translate3d(35px, 55px, 0)')
  })

  it('does not move when disabled', async () => {
    const wrapper = mount(IrisDragger, { props: { disabled: true } })
    await nextTick()
    const root = wrapper.element as HTMLElement

    root.dispatchEvent(makePointerEvent('pointerdown', { clientX: 10, clientY: 20 }))
    root.dispatchEvent(makePointerEvent('pointermove', { clientX: 35, clientY: 55 }))
    await nextTick()

    expect(root.style.transform).toContain('translate3d(0px, 0px, 0)')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
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
