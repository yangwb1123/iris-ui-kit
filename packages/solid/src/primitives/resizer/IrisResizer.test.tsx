import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisResizer } from './IrisResizer'

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

afterEach(cleanup)

describe('IrisResizer', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisResizer value={{ width: 200, height: 150 }}>
        <div>Content</div>
      </IrisResizer>
    ))
    expect(container.querySelector('[data-iris-resizer]')).not.toBeNull()
  })

  it('renders children content', () => {
    const { getByText } = render(() => (
      <IrisResizer value={{ width: 200, height: 150 }}>
        <div>Resizable content</div>
      </IrisResizer>
    ))
    expect(getByText('Resizable content')).toBeTruthy()
  })

  it('renders handles by default', () => {
    const { container } = render(() => (
      <IrisResizer value={{ width: 200, height: 150 }}>
        <div>Content</div>
      </IrisResizer>
    ))
    expect(container.querySelectorAll('[data-iris-resizer-handle]').length).toBe(8)
  })

  it('only renders specified handles', () => {
    const { container } = render(() => (
      <IrisResizer value={{ width: 200, height: 150 }} handles={['bottom-right']}>
        <div>Content</div>
      </IrisResizer>
    ))
    expect(container.querySelectorAll('[data-iris-resizer-handle]').length).toBe(1)
    expect(container.querySelector('[data-iris-resizer-handle="bottom-right"]')).not.toBeNull()
  })

  it('applies correct dimensions from value prop', () => {
    const { container } = render(() => (
      <IrisResizer value={{ width: 300, height: 200 }}>
        <div>Content</div>
      </IrisResizer>
    ))
    const el = container.querySelector('[data-iris-resizer]') as HTMLElement
    expect(el.style.width).toBe('300px')
    expect(el.style.height).toBe('200px')
  })

  it('provides named keyboard handles without regressing pointer dragging', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisResizer
        value={{ width: 100, height: 100 }}
        onChange={onChange}
        handles={['right']}
        maxWidth={300}
      >
        <div>Content</div>
      </IrisResizer>
    ))
    const handle = container.querySelector(
      '[data-iris-resizer-handle="right"]',
    ) as HTMLButtonElement

    expect(handle.tagName).toBe('BUTTON')
    expect(handle.getAttribute('aria-label')).toBe('Resize right')
    handle.focus()
    expect(document.activeElement).toBe(handle)

    handle.dispatchEvent(
      makePointerEvent('pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 100 }),
    )
    handle.dispatchEvent(
      makePointerEvent('pointermove', { pointerId: 1, clientX: 120, clientY: 100 }),
    )
    handle.dispatchEvent(
      makePointerEvent('pointerup', { pointerId: 1, clientX: 120, clientY: 100 }),
    )
    expect(onChange).toHaveBeenLastCalledWith({ width: 120, height: 100 })

    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith({ width: 110, height: 100 })
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith({ width: 40, height: 100 })
    fireEvent.keyDown(handle, { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith({ width: 300, height: 100 })
  })
})
