import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisResizable } from './Resizable'

function makePointerEvent(type: string, init: PointerEventInit = {}): Event {
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

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisResizable keyboard handle', () => {
  it('does not emit an infinite size when End is pressed without a finite maximum', () => {
    const onSizeChange = vi.fn()
    const { container } = render(
      <IrisResizable
        defaultSize={{ width: 100, height: 100 }}
        handles={['right']}
        onSizeChange={onSizeChange}
      >
        <span>x</span>
      </IrisResizable>,
    )
    const handle = container.querySelector(
      '[data-iris-resizable-handle=right]',
    ) as HTMLButtonElement

    fireEvent.keyDown(handle, { key: 'End' })
    expect(onSizeChange).not.toHaveBeenCalled()
    expect((container.querySelector('[data-iris-resizable]') as HTMLElement).style.width).toBe(
      '100px',
    )
  })

  it('is named and focusable; keyboard and pointer resizing both work', () => {
    const onSizeChange = vi.fn()
    const { container } = render(
      <IrisResizable
        defaultSize={{ width: 100, height: 100 }}
        handles={['right']}
        maxWidth={300}
        onSizeChange={onSizeChange}
      >
        <span>x</span>
      </IrisResizable>,
    )
    const handle = container.querySelector(
      '[data-iris-resizable-handle=right]',
    ) as HTMLButtonElement

    expect(handle.tagName).toBe('BUTTON')
    expect(handle.getAttribute('aria-label')).toBe('Resize right')
    handle.focus()
    expect(document.activeElement).toBe(handle)

    act(() => {
      handle.dispatchEvent(
        makePointerEvent('pointerdown', {
          button: 0,
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      )
      handle.dispatchEvent(
        makePointerEvent('pointermove', { pointerId: 1, clientX: 120, clientY: 100 }),
      )
      handle.dispatchEvent(
        makePointerEvent('pointerup', { pointerId: 1, clientX: 120, clientY: 100 }),
      )
    })
    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 120, height: 100 })

    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 130, height: 100 })
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 40, height: 100 })
    fireEvent.keyDown(handle, { key: 'End' })
    expect(onSizeChange).toHaveBeenLastCalledWith({ width: 300, height: 100 })
  })
})
