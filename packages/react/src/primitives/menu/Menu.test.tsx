import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisMenu } from './Menu'
import { IrisMenuTrigger } from './MenuTrigger'
import { IrisMenuContent } from './MenuContent'
import { IrisMenuItem, IrisMenuSeparator } from './MenuItem'
import { IrisMenuSub } from './MenuSub'

afterEach(() => cleanup())

function flat(props?: {
  defaultOpen?: boolean
  onSelectA?: (e: React.SyntheticEvent) => void
  disableB?: boolean
}) {
  return (
    <IrisMenu defaultOpen={props?.defaultOpen}>
      <IrisMenuTrigger>Actions</IrisMenuTrigger>
      <IrisMenuContent>
        <IrisMenuItem onSelect={props?.onSelectA}>A</IrisMenuItem>
        <IrisMenuItem disabled={props?.disableB}>B</IrisMenuItem>
        <IrisMenuItem>C</IrisMenuItem>
      </IrisMenuContent>
    </IrisMenu>
  )
}

function nested(props?: { onSelectLeaf?: (e: React.SyntheticEvent) => void }) {
  return (
    <IrisMenu defaultOpen>
      <IrisMenuTrigger>Actions</IrisMenuTrigger>
      <IrisMenuContent>
        <IrisMenuItem>Top</IrisMenuItem>
        <IrisMenuSub label="More…">
          <IrisMenuItem onSelect={props?.onSelectLeaf}>Leaf</IrisMenuItem>
        </IrisMenuSub>
      </IrisMenuContent>
    </IrisMenu>
  )
}

function menuEl(): HTMLElement | null {
  return document.querySelector('[data-iris-menu]')
}

describe('@iris-ui-kit/react IrisMenu', () => {
  it('renders only the trigger when closed', () => {
    render(flat())
    expect(document.querySelector('button')).not.toBeNull()
    expect(menuEl()).toBeNull()
  })

  it('clicking the trigger opens with role="menu"', () => {
    const { container } = render(flat())
    act(() => {
      fireEvent.click(container.querySelector('button')!)
    })
    expect(menuEl()).not.toBeNull()
    expect(menuEl()?.getAttribute('role')).toBe('menu')
  })

  it('ArrowDown on the closed trigger opens the menu', () => {
    const { container } = render(flat())
    expect(menuEl()).toBeNull()
    act(() => {
      fireEvent.keyDown(container.querySelector('button')!, { key: 'ArrowDown' })
    })
    expect(menuEl()).not.toBeNull()
  })

  it('clicking a menu item fires onSelect and closes the menu', () => {
    const onSelect = vi.fn()
    render(flat({ defaultOpen: true, onSelectA: onSelect }))
    const items = document.querySelectorAll('[role=menuitem]')
    act(() => {
      fireEvent.click(items[0]!)
    })
    expect(onSelect).toHaveBeenCalled()
    expect(menuEl()).toBeNull()
  })

  it('renders IrisMenuSeparator with role="separator"', () => {
    render(
      <IrisMenu defaultOpen>
        <IrisMenuTrigger>Actions</IrisMenuTrigger>
        <IrisMenuContent>
          <IrisMenuItem>A</IrisMenuItem>
          <IrisMenuSeparator />
          <IrisMenuItem>B</IrisMenuItem>
        </IrisMenuContent>
      </IrisMenu>,
    )
    const sep = document.querySelector('[data-iris-menu-separator]')
    expect(sep).not.toBeNull()
    expect(sep?.getAttribute('role')).toBe('separator')
  })

  it('disabled item is aria-disabled and not clickable', () => {
    const onSelect = vi.fn()
    render(flat({ defaultOpen: true, disableB: true }))
    const items = document.querySelectorAll('[role=menuitem]')
    expect(items[1]?.getAttribute('aria-disabled')).toBe('true')
    act(() => {
      fireEvent.click(items[1]!)
    })
    expect(menuEl()).not.toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('ArrowDown moves focus to next item', () => {
    render(flat({ defaultOpen: true }))
    const items = Array.from(document.querySelectorAll('[role=menuitem]')) as HTMLElement[]
    items[0]!.focus()
    act(() => {
      fireEvent.keyDown(menuEl()!, { key: 'ArrowDown' })
    })
    expect(document.activeElement).toBe(items[1])
  })

  it('Escape closes the menu', () => {
    render(flat({ defaultOpen: true }))
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(menuEl()).toBeNull()
  })

  it('outside pointerdown closes the menu', () => {
    const { container } = render(
      <div>
        <div data-testid="outside">x</div>
        {flat({ defaultOpen: true })}
      </div>,
    )
    expect(menuEl()).not.toBeNull()
    act(() => {
      fireEvent.pointerDown(container.querySelector('[data-testid=outside]')!)
    })
    expect(menuEl()).toBeNull()
  })

  it('Tab closes the root menu', () => {
    render(flat({ defaultOpen: true }))
    act(() => {
      fireEvent.keyDown(menuEl()!, { key: 'Tab' })
    })
    expect(menuEl()).toBeNull()
  })

  it('asChild trigger renders the provided element', () => {
    const { container } = render(
      <IrisMenu>
        <IrisMenuTrigger asChild>
          <a href="#x">Custom</a>
        </IrisMenuTrigger>
        <IrisMenuContent>
          <IrisMenuItem>A</IrisMenuItem>
        </IrisMenuContent>
      </IrisMenu>,
    )
    const link = container.querySelector('a')!
    expect(link.getAttribute('aria-haspopup')).toBe('menu')
    act(() => {
      fireEvent.click(link)
    })
    expect(menuEl()).not.toBeNull()
  })

  it('throws when trigger is used outside provider', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IrisMenuTrigger>x</IrisMenuTrigger>)).toThrow(
      /must be a descendant of <IrisMenu>/,
    )
    e.mockRestore()
  })
})

describe('@iris-ui-kit/react IrisMenuSub', () => {
  it('sub trigger renders with aria-haspopup=menu', () => {
    render(nested())
    const subTrig = document.querySelector('[data-iris-menu-sub-trigger]')!
    expect(subTrig.getAttribute('aria-haspopup')).toBe('menu')
    expect(subTrig.getAttribute('aria-expanded')).toBe('false')
  })

  it('clicking sub trigger opens the submenu', () => {
    render(nested())
    const subTrig = document.querySelector('[data-iris-menu-sub-trigger]') as HTMLElement
    act(() => {
      fireEvent.click(subTrig)
    })
    expect(document.querySelector('[data-iris-menu-sub]')).not.toBeNull()
  })

  it('ArrowRight on sub trigger opens', () => {
    render(nested())
    const subTrig = document.querySelector('[data-iris-menu-sub-trigger]') as HTMLElement
    subTrig.focus()
    act(() => {
      fireEvent.keyDown(subTrig, { key: 'ArrowRight' })
    })
    expect(document.querySelector('[data-iris-menu-sub]')).not.toBeNull()
  })

  it('ArrowLeft on submenu closes it', () => {
    render(nested())
    const subTrig = document.querySelector('[data-iris-menu-sub-trigger]') as HTMLElement
    act(() => {
      fireEvent.click(subTrig)
    })
    const sub = document.querySelector('[data-iris-menu-sub]') as HTMLElement
    expect(sub).not.toBeNull()
    act(() => {
      fireEvent.keyDown(sub, { key: 'ArrowLeft' })
    })
    expect(document.querySelector('[data-iris-menu-sub]')).toBeNull()
  })

  it('selecting a leaf item collapses the whole tree (closeRoot)', () => {
    const onSelect = vi.fn()
    render(nested({ onSelectLeaf: onSelect }))
    const subTrig = document.querySelector('[data-iris-menu-sub-trigger]') as HTMLElement
    act(() => {
      fireEvent.click(subTrig)
    })
    const leaf = document.querySelector('[data-iris-menu-sub] [role=menuitem]') as HTMLElement
    act(() => {
      fireEvent.click(leaf)
    })
    expect(onSelect).toHaveBeenCalled()
    expect(menuEl()).toBeNull()
    expect(document.querySelector('[data-iris-menu-sub]')).toBeNull()
  })
})
