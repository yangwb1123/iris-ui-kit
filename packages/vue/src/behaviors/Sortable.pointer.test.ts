import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { IrisSortable } from './Sortable'

function pointer(type: string, pointerId: number, x: number): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: x },
    clientY: { value: 10 },
    pointerId: { value: pointerId },
  })
  return event
}

describe('@iris-ui-kit/vue IrisSortable pointer capture', () => {
  it('preserves a child tap, shows a drag cursor, and captures only after drag starts', async () => {
    const clicked = vi.fn()
    const wrapper = mount(IrisSortable, {
      props: { items: ['A'], getKey: (item: unknown) => String(item) },
      slots: { default: () => h('button', { onClick: clicked }, 'A') },
    })
    const root = wrapper.find('[data-iris-sortable]').element as HTMLElement
    const button = wrapper.find('button').element
    expect(root.style.cursor).toBe('grab')
    const capture = vi.fn()
    Object.defineProperty(root, 'setPointerCapture', { value: capture })

    button.dispatchEvent(pointer('pointerdown', 7, 0))
    expect(capture).not.toHaveBeenCalled()
    button.dispatchEvent(pointer('pointerup', 7, 0))
    button.click()
    expect(clicked).toHaveBeenCalledOnce()

    button.dispatchEvent(pointer('pointerdown', 8, 0))
    button.dispatchEvent(pointer('pointermove', 8, 10))
    await nextTick()
    expect(capture).toHaveBeenCalledWith(8)
    expect(root.style.cursor).toBe('grabbing')
    button.dispatchEvent(pointer('pointerup', 8, 10))
    await nextTick()
    expect(root.style.cursor).toBe('grab')
    wrapper.unmount()
  })
})
