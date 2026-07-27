import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisSlot } from './Slot'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisSlot', () => {
  it('clones the single child and forwards arbitrary attrs', () => {
    const { container } = render(
      <IrisSlot data-test="slot">
        <button type="button">click</button>
      </IrisSlot>,
    )
    const btn = container.querySelector('button')!
    expect(btn).not.toBeNull()
    expect(btn.getAttribute('data-test')).toBe('slot')
  })

  it('returns null when no valid React element child is provided', () => {
    const { container } = render(<IrisSlot>{'just a string'}</IrisSlot>)
    expect(container.firstChild).toBeNull()
  })

  it('shallow-merges style, child overrides on collision', () => {
    const { container } = render(
      <IrisSlot style={{ color: 'red', background: 'blue' }}>
        <span style={{ color: 'green' }}>x</span>
      </IrisSlot>,
    )
    const span = container.querySelector('span')!
    expect(span.style.color).toBe('green')
    expect(span.style.background).toBe('blue')
  })

  it('concatenates className', () => {
    const { container } = render(
      <IrisSlot className="from-slot">
        <span className="from-child">x</span>
      </IrisSlot>,
    )
    const span = container.querySelector('span')!
    expect(span.className.split(' ').sort()).toEqual(['from-child', 'from-slot'])
  })

  it('composes event handlers — slot handler runs first, then child handler', () => {
    const calls: string[] = []
    const { container } = render(
      <IrisSlot onClick={() => calls.push('slot')}>
        <button type="button" onClick={() => calls.push('child')}>
          x
        </button>
      </IrisSlot>,
    )
    fireEvent.click(container.querySelector('button')!)
    expect(calls).toEqual(['slot', 'child'])
  })

  it('child handler can short-circuit slot chain via preventDefault', () => {
    // composeEventHandlers stops once event.defaultPrevented becomes true.
    // We test the inverse: slot handler preventDefault, child handler suppressed.
    const calls: string[] = []
    const { container } = render(
      <IrisSlot
        onClick={(e: React.MouseEvent) => {
          calls.push('slot')
          e.preventDefault()
        }}
      >
        <button type="button" onClick={() => calls.push('child')}>
          x
        </button>
      </IrisSlot>,
    )
    fireEvent.click(container.querySelector('button')!)
    expect(calls).toEqual(['slot'])
  })

  it('child non-event props override slot props', () => {
    const { container } = render(
      <IrisSlot id="from-slot" data-from="slot">
        <span id="from-child" data-from="child">
          x
        </span>
      </IrisSlot>,
    )
    const span = container.querySelector('span')!
    expect(span.id).toBe('from-child')
    expect(span.getAttribute('data-from')).toBe('child')
  })

  it('preserves attrs that only exist on slot side', () => {
    const { container } = render(
      <IrisSlot data-from-slot="yes">
        <span data-from-child="yes">x</span>
      </IrisSlot>,
    )
    const span = container.querySelector('span')!
    expect(span.getAttribute('data-from-slot')).toBe('yes')
    expect(span.getAttribute('data-from-child')).toBe('yes')
  })

  it('forwards ref to the underlying element', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(
      <IrisSlot ref={ref as unknown as React.Ref<unknown>}>
        <button type="button">x</button>
      </IrisSlot>,
    )
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('combines forwarded ref with child own ref', () => {
    const slotRef = React.createRef<HTMLButtonElement>()
    const childRef = vi.fn()
    render(
      <IrisSlot ref={slotRef as unknown as React.Ref<unknown>}>
        <button type="button" ref={childRef}>
          x
        </button>
      </IrisSlot>,
    )
    expect(slotRef.current).toBeInstanceOf(HTMLButtonElement)
    expect(childRef).toHaveBeenCalledWith(expect.any(HTMLButtonElement))
  })
})
