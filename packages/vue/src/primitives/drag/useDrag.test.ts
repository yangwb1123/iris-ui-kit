import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useDrag, type DragState } from './useDrag'

function makePointerEvent(type: string, init: PointerEventInit = {}): Event {
  // jsdom may not implement PointerEvent — fall back to a synthetic Event
  // and decorate with the fields useDrag reads.
  const PointerCtor = (globalThis as Record<string, unknown>).PointerEvent
  if (typeof PointerCtor === 'function') {
    return new (PointerCtor as new (type: string, init?: EventInit) => Event)(type, {
      bubbles: true,
      ...init,
    })
  }
  const event = new Event(type, { bubbles: true })
  Object.assign(event, {
    button: init.button ?? 0,
    buttons: init.buttons ?? 1,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    pointerId: init.pointerId ?? 1,
  })
  return event
}

describe('useDrag', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => {
    host.remove()
  })

  function buildHarness(opts: {
    onStart?: (s: DragState) => boolean | void
    onDrag?: (s: DragState) => void
    onEnd?: (s: DragState) => void
    disabled?: boolean
  }) {
    return defineComponent({
      setup() {
        const handle = ref<HTMLElement | null>(null)
        const disabled = ref(opts.disabled ?? false)
        useDrag({
          handle,
          onStart: opts.onStart,
          onDrag: opts.onDrag,
          onEnd: opts.onEnd,
          disabled,
        })
        return () =>
          h('div', {
            class: 'handle',
            ref: (el: unknown) => {
              handle.value = (el ?? null) as HTMLElement | null
            },
            style: { width: '40px', height: '40px' },
          })
      },
    })
  }

  it('fires onStart, onDrag, onEnd with deltas', async () => {
    const events: string[] = []
    let lastDx = 0
    let lastDy = 0
    const wrapper = mount(
      buildHarness({
        onStart: () => events.push('start'),
        onDrag: (s) => {
          events.push('drag')
          lastDx = s.dx
          lastDy = s.dy
        },
        onEnd: () => events.push('end'),
      }),
      { attachTo: host },
    )
    await nextTick()
    const handle = wrapper.find('.handle').element as HTMLElement
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientX: 100, clientY: 200 }))
    handle.dispatchEvent(makePointerEvent('pointermove', { clientX: 120, clientY: 240 }))
    handle.dispatchEvent(makePointerEvent('pointerup', { clientX: 120, clientY: 240 }))
    expect(events).toEqual(['start', 'drag', 'end'])
    expect(lastDx).toBe(20)
    expect(lastDy).toBe(40)
  })

  it('does not fire move/end if onStart returns false', async () => {
    const events: string[] = []
    const wrapper = mount(
      buildHarness({
        onStart: () => {
          events.push('start')
          return false
        },
        onDrag: () => events.push('drag'),
        onEnd: () => events.push('end'),
      }),
      { attachTo: host },
    )
    await nextTick()
    const handle = wrapper.find('.handle').element as HTMLElement
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    handle.dispatchEvent(makePointerEvent('pointermove', { clientX: 50, clientY: 50 }))
    handle.dispatchEvent(makePointerEvent('pointerup', { clientX: 50, clientY: 50 }))
    expect(events).toEqual(['start'])
  })

  it('disabled blocks all events', async () => {
    const events: string[] = []
    const wrapper = mount(
      buildHarness({
        onStart: () => events.push('start'),
        onDrag: () => events.push('drag'),
        onEnd: () => events.push('end'),
        disabled: true,
      }),
      { attachTo: host },
    )
    await nextTick()
    const handle = wrapper.find('.handle').element as HTMLElement
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    handle.dispatchEvent(makePointerEvent('pointermove', { clientX: 50, clientY: 50 }))
    handle.dispatchEvent(makePointerEvent('pointerup'))
    expect(events).toEqual([])
  })

  it('pointercancel ends the drag like pointerup', async () => {
    const events: string[] = []
    const wrapper = mount(
      buildHarness({
        onStart: () => events.push('start'),
        onDrag: () => events.push('drag'),
        onEnd: () => events.push('end'),
      }),
      { attachTo: host },
    )
    await nextTick()
    const handle = wrapper.find('.handle').element as HTMLElement
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    handle.dispatchEvent(makePointerEvent('pointercancel'))
    expect(events).toEqual(['start', 'end'])
  })
})
