import { cleanup, fireEvent, render } from '@testing-library/svelte'
import { afterEach, describe, it, expect, vi } from 'vitest'
import SlotHarness from './SlotHarness.svelte'

afterEach(cleanup)

describe('IrisSlot', () => {
  it('merges attrs, class, style, events and refs onto one child', async () => {
    const calls: string[] = []
    let parentRef: HTMLElement | undefined
    let childRef: HTMLElement | undefined
    const { container, getByText } = render(SlotHarness, {
      props: {
        parentClick: () => calls.push('slot'),
        childClick: () => calls.push('child'),
        parentRef: (element) => {
          parentRef = element
        },
        childRef: (element) => {
          childRef = element
        },
      },
    })

    const anchor = getByText('slot child') as HTMLAnchorElement
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toBe(anchor)
    expect(container.querySelector('[data-iris-slot]')).toBeNull()
    expect(anchor.id).toBe('slot-id')
    expect(anchor.className).toBe('slot-class child-class')
    expect(anchor.style.color).toBe('blue')
    expect(anchor.style.background).toBe('black')
    expect(anchor.dataset.slot).toBe('yes')
    expect(anchor.dataset.child).toBe('yes')
    expect(parentRef).toBe(anchor)
    expect(childRef).toBe(anchor)

    await fireEvent.click(anchor)
    expect(calls).toEqual(['slot', 'child'])
  })

  it('skips the child handler after the Slot prevents default', async () => {
    const childClick = vi.fn()
    const { getByText } = render(SlotHarness, {
      props: { prevent: true, childClick },
    })

    await fireEvent.click(getByText('slot child'))
    expect(childClick).not.toHaveBeenCalled()
  })
})
