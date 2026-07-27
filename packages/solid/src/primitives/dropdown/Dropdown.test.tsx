import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisDropdown } from './Dropdown'
import { IrisDropdownTrigger } from './DropdownTrigger'
import { IrisDropdownMenu } from './DropdownMenu'
import { IrisDropdownItem } from './DropdownItem'

afterEach(cleanup)

function harness(onSelect?: () => void) {
  return (
    <IrisDropdown>
      <IrisDropdownTrigger>Actions</IrisDropdownTrigger>
      <IrisDropdownMenu portalTarget={false}>
        <IrisDropdownItem onSelect={onSelect}>Copy</IrisDropdownItem>
        <IrisDropdownItem>Delete</IrisDropdownItem>
      </IrisDropdownMenu>
    </IrisDropdown>
  )
}

describe('@iris-ui-kit/solid IrisDropdown', () => {
  it('opens on trigger click and renders role=menu + menuitems', () => {
    const { getByText, container } = render(() => harness())
    expect(container.querySelector('[data-iris-dropdown-menu]')).toBeNull()
    fireEvent.click(getByText('Actions'))
    expect(container.querySelector('[role="menu"]')).not.toBeNull()
    expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(2)
  })

  it('trigger reflects aria-expanded', () => {
    const { getByText } = render(() => harness())
    const trigger = getByText('Actions')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('selecting an item fires onSelect and closes the menu', () => {
    const onSelect = vi.fn()
    const { getByText, container } = render(() => harness(onSelect))
    fireEvent.click(getByText('Actions'))
    fireEvent.click(getByText('Copy'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-iris-dropdown-menu]')).toBeNull()
  })

  it('typeahead focuses the item whose label matches a typed character', () => {
    const { getByText } = render(() => harness())
    fireEvent.click(getByText('Actions'))
    const menu = document.querySelector('[role="menu"]') as HTMLElement
    const copy = getByText('Copy') as HTMLElement
    const del = getByText('Delete') as HTMLElement
    copy.focus()
    fireEvent.keyDown(menu, { key: 'd' })
    expect(document.activeElement).toBe(del)
  })

  it('Escape closes the menu', () => {
    const { getByText, container } = render(() => harness())
    fireEvent.click(getByText('Actions'))
    expect(container.querySelector('[role="menu"]')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })
})
