import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import PopoverHarness from './PopoverHarness.svelte'

afterEach(cleanup)

describe('IrisPopover', () => {
  it('renders without crashing', () => {
    const { container } = render(PopoverHarness)
    expect(container).toBeTruthy()
  })

  it('content is not shown initially', () => {
    const { container } = render(PopoverHarness)
    expect(container.querySelector('[data-iris-popover-content]')).toBeNull()
  })

  it('opens on trigger click', async () => {
    const { getByText } = render(PopoverHarness)
    await fireEvent.click(getByText('Open Popover'))
    expect(document.querySelector('[data-iris-popover-content]')).not.toBeNull()
  })

  it('closes on second trigger click', async () => {
    const { getByText } = render(PopoverHarness)
    await fireEvent.click(getByText('Open Popover'))
    await fireEvent.click(getByText('Open Popover'))
    expect(document.querySelector('[data-iris-popover-content]')).toBeNull()
  })

  it('trigger reflects aria-expanded', async () => {
    const { getByText } = render(PopoverHarness)
    const trigger = getByText('Open Popover')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })
})
