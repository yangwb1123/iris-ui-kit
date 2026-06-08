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
})
