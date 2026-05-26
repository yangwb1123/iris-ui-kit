import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisDropdown } from './Dropdown'
import { IrisDropdownTrigger } from './DropdownTrigger'
import { IrisDropdownMenu } from './DropdownMenu'
import { IrisDropdownItem, IrisDropdownSeparator } from './DropdownItem'

afterEach(() => cleanup())

function harness(props?: {
  onSelectA?: (e: React.SyntheticEvent) => void
  onSelectB?: (e: React.SyntheticEvent) => void
  onSelectC?: (e: React.SyntheticEvent) => void
  defaultOpen?: boolean
  disableB?: boolean
}) {
  return (
    <IrisDropdown defaultOpen={props?.defaultOpen}>
      <IrisDropdownTrigger>Open</IrisDropdownTrigger>
      <IrisDropdownMenu>
        <IrisDropdownItem onSelect={props?.onSelectA}>A</IrisDropdownItem>
        <IrisDropdownItem onSelect={props?.onSelectB} disabled={props?.disableB}>
          B
        </IrisDropdownItem>
        <IrisDropdownSeparator />
        <IrisDropdownItem onSelect={props?.onSelectC}>C</IrisDropdownItem>
      </IrisDropdownMenu>
    </IrisDropdown>
  )
}

function menu(): HTMLElement | null {
  return document.querySelector('[role=menu]')
}

function items(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role=menuitem]'))
}

describe('@iris-ui/react IrisDropdown', () => {
  it('renders only the trigger when closed', () => {
    const { container } = render(harness())
    expect(container.querySelector('button')).not.toBeNull()
    expect(menu()).toBeNull()
  })

  it('trigger click opens the menu', () => {
    const { container } = render(harness())
    act(() => {
      fireEvent.click(container.querySelector('button')!)
    })
    expect(menu()).not.toBeNull()
  })

  it('aria-haspopup="menu" + aria-expanded reflect state', () => {
    const { container } = render(harness())
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-haspopup')).toBe('menu')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    act(() => {
      fireEvent.click(btn)
    })
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('clicking an item invokes onSelect and closes', () => {
    const onSelectA = vi.fn()
    render(harness({ defaultOpen: true, onSelectA }))
    const [first] = items()
    act(() => {
      fireEvent.click(first!)
    })
    expect(onSelectA).toHaveBeenCalledOnce()
    expect(menu()).toBeNull()
  })

  it('disabled item does not fire onSelect and does not close', () => {
    const onSelectB = vi.fn()
    render(harness({ defaultOpen: true, disableB: true, onSelectB }))
    const [, b] = items()
    expect(b!.getAttribute('aria-disabled')).toBe('true')
    act(() => {
      fireEvent.click(b!)
    })
    expect(onSelectB).not.toHaveBeenCalled()
    expect(menu()).not.toBeNull()
  })

  it('separator has role="separator"', () => {
    render(harness({ defaultOpen: true }))
    expect(document.querySelector('[role=separator]')).not.toBeNull()
  })

  it('ArrowDown moves focus across items', () => {
    render(harness({ defaultOpen: true }))
    const [a, b, c] = items()
    a!.focus()
    act(() => {
      fireEvent.keyDown(menu()!, { key: 'ArrowDown' })
    })
    expect(document.activeElement).toBe(b)
    act(() => {
      fireEvent.keyDown(menu()!, { key: 'ArrowDown' })
    })
    expect(document.activeElement).toBe(c)
  })

  it('ArrowDown skips disabled items', () => {
    render(harness({ defaultOpen: true, disableB: true }))
    const [a, , c] = items()
    a!.focus()
    act(() => {
      fireEvent.keyDown(menu()!, { key: 'ArrowDown' })
    })
    expect(document.activeElement).toBe(c)
  })

  it('ArrowUp wraps to the last item from the first', () => {
    render(harness({ defaultOpen: true }))
    const [a, , c] = items()
    a!.focus()
    act(() => {
      fireEvent.keyDown(menu()!, { key: 'ArrowUp' })
    })
    expect(document.activeElement).toBe(c)
  })

  it('Home and End jump to first/last items', () => {
    render(harness({ defaultOpen: true }))
    const [a, b, c] = items()
    b!.focus()
    act(() => {
      fireEvent.keyDown(menu()!, { key: 'End' })
    })
    expect(document.activeElement).toBe(c)
    act(() => {
      fireEvent.keyDown(menu()!, { key: 'Home' })
    })
    expect(document.activeElement).toBe(a)
  })

  it('Enter on a focused item triggers select + close', () => {
    const onSelectA = vi.fn()
    render(harness({ defaultOpen: true, onSelectA }))
    const [a] = items()
    a!.focus()
    act(() => {
      fireEvent.keyDown(a!, { key: 'Enter' })
    })
    expect(onSelectA).toHaveBeenCalledOnce()
    expect(menu()).toBeNull()
  })

  it('Tab closes the menu', () => {
    render(harness({ defaultOpen: true }))
    expect(menu()).not.toBeNull()
    act(() => {
      fireEvent.keyDown(menu()!, { key: 'Tab' })
    })
    expect(menu()).toBeNull()
  })

  it('Escape closes the menu', () => {
    render(harness({ defaultOpen: true }))
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(menu()).toBeNull()
  })

  it('outside pointerdown closes the menu', () => {
    const { container } = render(
      <div>
        <div data-testid="outside">x</div>
        {harness({ defaultOpen: true })}
      </div>,
    )
    expect(menu()).not.toBeNull()
    const outside = container.querySelector('[data-testid=outside]')!
    act(() => {
      fireEvent.pointerDown(outside)
    })
    expect(menu()).toBeNull()
  })

  it('keepOpen item does not close menu', () => {
    const onSelect = vi.fn()
    render(
      <IrisDropdown defaultOpen>
        <IrisDropdownTrigger>x</IrisDropdownTrigger>
        <IrisDropdownMenu>
          <IrisDropdownItem keepOpen onSelect={onSelect}>
            sticky
          </IrisDropdownItem>
        </IrisDropdownMenu>
      </IrisDropdown>,
    )
    const [it] = items()
    act(() => {
      fireEvent.click(it!)
    })
    expect(onSelect).toHaveBeenCalledOnce()
    expect(menu()).not.toBeNull()
  })

  it('menu uses portal by default', () => {
    const { container } = render(harness({ defaultOpen: true }))
    expect(container.querySelector('[role=menu]')).toBeNull()
    expect(document.body.querySelector('[role=menu]')).not.toBeNull()
  })

  it('portalTarget={false} renders menu inline', () => {
    const { container } = render(
      <IrisDropdown defaultOpen>
        <IrisDropdownTrigger>x</IrisDropdownTrigger>
        <IrisDropdownMenu portalTarget={false}>
          <IrisDropdownItem>A</IrisDropdownItem>
        </IrisDropdownMenu>
      </IrisDropdown>,
    )
    expect(container.querySelector('[role=menu]')).not.toBeNull()
  })

  it('asChild trigger renders the provided element', () => {
    const { container } = render(
      <IrisDropdown>
        <IrisDropdownTrigger asChild>
          <a href="#x">Actions</a>
        </IrisDropdownTrigger>
        <IrisDropdownMenu>
          <IrisDropdownItem>A</IrisDropdownItem>
        </IrisDropdownMenu>
      </IrisDropdown>,
    )
    const link = container.querySelector('a')!
    expect(link.getAttribute('aria-haspopup')).toBe('menu')
    act(() => {
      fireEvent.click(link)
    })
    expect(menu()).not.toBeNull()
  })
})
