import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import ToggleGroupHarness from './ToggleGroupHarness.svelte'

describe('IrisToggleGroup', () => {
  it('renders items', () => {
    const { getByText } = render(ToggleGroupHarness)
    expect(getByText('Bold')).toBeTruthy()
    expect(getByText('Italic')).toBeTruthy()
  })

  it('calls onchange when item clicked (single)', async () => {
    const onchange = vi.fn()
    const { getByText } = render(ToggleGroupHarness, {
      props: { type: 'single', value: null, onchange },
    })
    await fireEvent.click(getByText('Bold'))
    flushSync()
    expect(onchange).toHaveBeenCalledWith('bold')
  })

  it('shows active state', () => {
    const { container } = render(ToggleGroupHarness, {
      props: { type: 'single', value: 'bold' },
    })
    const items = container.querySelectorAll('[data-iris-toggle-group-item]')
    expect(items[0].getAttribute('data-state')).toBe('on')
    expect(items[1].getAttribute('data-state')).toBe('off')
  })

  // Controlled value renders from the prop (reject → no flip; accept → flips).
  it('controlled value renders from the prop, not optimistically', async () => {
    const onchange = vi.fn()
    const { container, rerender } = render(ToggleGroupHarness, {
      props: { type: 'single', value: 'bold', onchange },
    })
    const items = container.querySelectorAll('[data-iris-toggle-group-item]')
    expect(items[0].getAttribute('data-state')).toBe('on')
    expect(items[1].getAttribute('data-state')).toBe('off')

    // Press Italic: onchange fires, but a controlled parent that does NOT write
    // `value` back means the active item must NOT flip.
    await fireEvent.click(items[1])
    flushSync()
    expect(onchange).toHaveBeenCalledWith('italic')
    expect(items[0].getAttribute('data-state')).toBe('on')
    expect(items[1].getAttribute('data-state')).toBe('off')
    expect(items[0].getAttribute('aria-checked')).toBe('true')
    expect(items[1].getAttribute('aria-checked')).toBe('false')

    // Parent accepts: write the new value back → now it flips.
    await rerender({ type: 'single', value: 'italic', onchange })
    flushSync()
    expect(items[0].getAttribute('data-state')).toBe('off')
    expect(items[1].getAttribute('data-state')).toBe('on')
    expect(items[1].getAttribute('aria-checked')).toBe('true')
  })
})
