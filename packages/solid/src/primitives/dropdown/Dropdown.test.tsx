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

describe('@iris-ui/solid IrisDropdown', () => {
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

  it('Escape closes the menu', () => {
    const { getByText, container } = render(() => harness())
    fireEvent.click(getByText('Actions'))
    expect(container.querySelector('[role="menu"]')).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })
})
