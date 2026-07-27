import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import DropdownHarness from './DropdownHarness.svelte'
import DropdownAsChildHarness from './DropdownAsChildHarness.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisDropdown', () => {
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

  it('typeahead focuses the item whose label matches a typed character', async () => {
    const { getByText, container } = render(DropdownHarness)
    await fireEvent.click(getByText('Actions'))
    const copy = getByText('Copy')
    const del = getByText('Delete')
    copy.focus()
    const menu = container.querySelector('[role="menu"]')!
    await fireEvent.keyDown(menu, { key: 'd' })
    expect(document.activeElement).toBe(del)
  })

  it('Escape closes the menu', async () => {
    const { getByText, container } = render(DropdownHarness)
    await fireEvent.click(getByText('Actions'))
    expect(container.querySelector('[role="menu"]')).not.toBeNull()
    await fireEvent.keyDown(document, { key: 'Escape' })
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  it('asChild renders one custom trigger and preserves its handler', async () => {
    const childClick = vi.fn()
    const { getByText, container } = render(DropdownAsChildHarness, {
      props: { childClick },
    })

    const trigger = getByText('Custom actions') as HTMLAnchorElement
    expect(container.querySelector('button')).toBeNull()
    expect(trigger.id).toBe('custom-trigger')
    expect(trigger.className).toBe('parent child')
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    await fireEvent.click(trigger)
    expect(childClick).toHaveBeenCalledTimes(1)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[role="menu"]')).not.toBeNull()
  })
})
