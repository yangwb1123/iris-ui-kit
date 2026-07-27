import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisSlot } from './IrisSlot'

afterEach(cleanup)

describe('IrisSlot', () => {
  it('merges props onto its only child with no wrapper', () => {
    const calls: string[] = []
    let slotRef: HTMLElement | undefined
    let childRef: HTMLAnchorElement | undefined
    const { container, getByText } = render(() => (
      <IrisSlot
        id="slot-id"
        class="slot-class"
        style={{ color: 'red', background: 'black' }}
        data-slot="yes"
        ref={(element) => {
          slotRef = element
        }}
        onClick={() => calls.push('slot')}
      >
        <a
          href="/child"
          class="child-class"
          style={{ color: 'blue' }}
          data-child="yes"
          ref={(element) => {
            childRef = element
          }}
          onClick={(event) => {
            event.preventDefault()
            calls.push('child')
          }}
        >
          hello
        </a>
      </IrisSlot>
    ))

    const anchor = getByText('hello') as HTMLAnchorElement
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toBe(anchor)
    expect(container.querySelector('[data-iris-slot]')).toBeNull()
    expect(anchor.id).toBe('slot-id')
    expect(anchor.className).toBe('slot-class child-class')
    expect(anchor.style.color).toBe('blue')
    expect(anchor.style.background).toBe('black')
    expect(anchor.dataset.slot).toBe('yes')
    expect(anchor.dataset.child).toBe('yes')
    expect(slotRef).toBe(anchor)
    expect(childRef).toBe(anchor)

    fireEvent.click(anchor)
    expect(calls).toEqual(['slot', 'child'])
  })

  it('skips the child handler when the Slot handler prevents default', () => {
    const childClick = vi.fn()
    const { getByText } = render(() => (
      <IrisSlot onClick={(event: MouseEvent) => event.preventDefault()}>
        <a href="/blocked" onClick={childClick}>
          blocked
        </a>
      </IrisSlot>
    ))

    fireEvent.click(getByText('blocked'))
    expect(childClick).not.toHaveBeenCalled()
  })
})
