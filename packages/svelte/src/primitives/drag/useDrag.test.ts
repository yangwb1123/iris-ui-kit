import { render } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect } from 'vitest'
import DragHarness from './DragHarness.svelte'

function makePointerEvent(type: string, init: PointerEventInit = {}): Event {
  // jsdom may not implement PointerEvent — fall back to a synthetic Event
  // decorated with the fields useDrag reads.
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

describe('@iris-ui/svelte useDrag', () => {
  it('fires onStart, onDrag, onEnd with cumulative deltas', () => {
    const events: string[] = []
    let lastDx = 0
    let lastDy = 0
    const { container } = render(DragHarness, {
      props: {
        onStart: () => void events.push('start'),
        onDrag: (s) => {
          events.push('drag')
          lastDx = s.dx
          lastDy = s.dy
        },
        onEnd: () => void events.push('end'),
      },
    })
    flushSync()
    const handle = container.querySelector('.handle') as HTMLElement
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientX: 100, clientY: 200 }))
    handle.dispatchEvent(makePointerEvent('pointermove', { clientX: 120, clientY: 240 }))
    handle.dispatchEvent(makePointerEvent('pointerup', { clientX: 120, clientY: 240 }))
    expect(events).toEqual(['start', 'drag', 'end'])
    expect(lastDx).toBe(20)
    expect(lastDy).toBe(40)
  })

  it('does not fire move/end if onStart returns false', () => {
    const events: string[] = []
    const { container } = render(DragHarness, {
      props: {
        onStart: () => {
          events.push('start')
          return false
        },
        onDrag: () => void events.push('drag'),
        onEnd: () => void events.push('end'),
      },
    })
    flushSync()
    const handle = container.querySelector('.handle') as HTMLElement
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    handle.dispatchEvent(makePointerEvent('pointermove', { clientX: 50, clientY: 50 }))
    handle.dispatchEvent(makePointerEvent('pointerup', { clientX: 50, clientY: 50 }))
    expect(events).toEqual(['start'])
  })

  it('disabled blocks all events', () => {
    const events: string[] = []
    const { container } = render(DragHarness, {
      props: {
        disabled: true,
        onStart: () => void events.push('start'),
        onDrag: () => void events.push('drag'),
        onEnd: () => void events.push('end'),
      },
    })
    flushSync()
    const handle = container.querySelector('.handle') as HTMLElement
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    handle.dispatchEvent(makePointerEvent('pointermove', { clientX: 50, clientY: 50 }))
    handle.dispatchEvent(makePointerEvent('pointerup'))
    expect(events).toEqual([])
  })

  it('pointercancel ends the drag like pointerup', () => {
    const events: string[] = []
    const { container } = render(DragHarness, {
      props: {
        onStart: () => void events.push('start'),
        onDrag: () => void events.push('drag'),
        onEnd: () => void events.push('end'),
      },
    })
    flushSync()
    const handle = container.querySelector('.handle') as HTMLElement
    handle.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    handle.dispatchEvent(makePointerEvent('pointercancel'))
    expect(events).toEqual(['start', 'end'])
  })

  it('ignores non-primary buttons by default', () => {
    const events: string[] = []
    const { container } = render(DragHarness, {
      props: {
        onStart: () => void events.push('start'),
      },
    })
    flushSync()
    const handle = container.querySelector('.handle') as HTMLElement
    handle.dispatchEvent(makePointerEvent('pointerdown', { button: 2, clientX: 0, clientY: 0 }))
    expect(events).toEqual([])
  })
})
