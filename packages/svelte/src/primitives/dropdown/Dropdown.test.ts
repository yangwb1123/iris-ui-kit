import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import DropdownHarness from './DropdownHarness.svelte'

afterEach(cleanup)

describe('@iris-ui/svelte IrisDropdown', () => {
  it('opens on trigger click and renders role=menu + menuitems', async () => {
    const { getByText, container } = render(DropdownHarness)
    expect(container.querySelector('[data-iris-dropdown-menu]')).toBeNull()
    await fireEvent.click(getByText('Actions'))
    expect(container.querySelector('[role="menu"]')).not.toBeNull()
    expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(2)
  })

  it('trigger reflects aria-expanded', async () => {
    const { getByText } = render(DropdownHarness)
    const trigger = getByText('Actions')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('selecting an item fires onSelect and closes the menu', async () => {
    const onSelect = vi.fn()
    const { getByText, container } = render(DropdownHarness, { props: { onSelect } })
    await fireEvent.click(getByText('Actions'))
    await fireEvent.click(getByText('Copy'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-iris-dropdown-menu]')).toBeNull()
  })

  it('Escape closes the menu', async () => {
    const { getByText, container } = render(DropdownHarness)
    await fireEvent.click(getByText('Actions'))
    expect(container.querySelector('[role="menu"]')).not.toBeNull()
    await fireEvent.keyDown(document, { key: 'Escape' })
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })
})
