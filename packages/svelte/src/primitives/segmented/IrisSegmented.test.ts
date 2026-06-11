import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisSegmented from './IrisSegmented.svelte'

describe('IrisSegmented', () => {
  it('renders options', () => {
    const { container } = render(IrisSegmented, {
      props: { options: ['One', 'Two', 'Three'] },
    })
    const items = container.querySelectorAll('[data-iris-segmented-item]')
    expect(items.length).toBe(3)
  })

  it('calls onchange when an option is clicked', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisSegmented, {
      props: { options: ['One', 'Two'], onchange },
    })
    const btns = container.querySelectorAll('[data-iris-segmented-item]')
    await fireEvent.click(btns[1])
    flushSync()
    expect(onchange).toHaveBeenCalledWith('Two')
  })

  it('marks selected item with data-selected', () => {
    const { container } = render(IrisSegmented, {
      props: { options: ['One', 'Two'], value: 'Two' },
    })
    const items = container.querySelectorAll('[data-iris-segmented-item]')
    expect(items[1].getAttribute('data-selected')).toBe('true')
    expect(items[0].getAttribute('data-selected')).toBeNull()
  })

  // Controlled value renders from the prop (reject → no flip; accept → flips).
  it('controlled value renders from the prop, not optimistically', async () => {
    const onchange = vi.fn()
    const { container, rerender } = render(IrisSegmented, {
      props: { options: ['One', 'Two'], value: 'One', onchange },
    })
    const items = container.querySelectorAll('[data-iris-segmented-item]')
    expect(items[0].getAttribute('aria-checked')).toBe('true')
    expect(items[1].getAttribute('aria-checked')).toBe('false')

    // Click the second segment: onchange fires, but a controlled parent that
    // does NOT write `value` back means the active segment must NOT flip.
    await fireEvent.click(items[1])
    flushSync()
    expect(onchange).toHaveBeenCalledWith('Two')
    expect(items[0].getAttribute('aria-checked')).toBe('true')
    expect(items[1].getAttribute('aria-checked')).toBe('false')
    expect(items[0].getAttribute('data-selected')).toBe('true')
    expect(items[1].getAttribute('data-selected')).toBeNull()

    // Parent accepts: write the new value back → now it flips.
    await rerender({ options: ['One', 'Two'], value: 'Two', onchange })
    flushSync()
    expect(items[0].getAttribute('aria-checked')).toBe('false')
    expect(items[1].getAttribute('aria-checked')).toBe('true')
    expect(items[1].getAttribute('data-selected')).toBe('true')
  })
})
