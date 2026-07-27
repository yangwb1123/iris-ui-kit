import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisPopover } from './Popover'
import { IrisPopoverTrigger } from './PopoverTrigger'
import { IrisPopoverContent } from './PopoverContent'

afterEach(() => cleanup())

function harness(props?: {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (next: boolean) => void
  trigger?: React.ReactNode
}) {
  return (
    <IrisPopover
      defaultOpen={props?.defaultOpen}
      open={props?.open}
      onOpenChange={props?.onOpenChange}
    >
      <IrisPopoverTrigger>{props?.trigger ?? 'Toggle'}</IrisPopoverTrigger>
      <IrisPopoverContent>
        <div data-testid="content-inner">Hello</div>
      </IrisPopoverContent>
    </IrisPopover>
  )
}

function dialog(): HTMLElement | null {
  return document.querySelector('[role=dialog]')
}

describe('@iris-ui-kit/react IrisPopover', () => {
  it('renders only the trigger when closed', () => {
    const { container } = render(harness())
    expect(container.querySelector('button')).not.toBeNull()
    expect(dialog()).toBeNull()
  })

  it('trigger click opens the popover (uncontrolled)', () => {
    const { container } = render(harness())
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.click(btn)
    })
    expect(dialog()).not.toBeNull()
  })

  it('trigger click toggles closed (uncontrolled)', () => {
    const { container } = render(harness())
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.click(btn)
    })
    expect(dialog()).not.toBeNull()
    act(() => {
      fireEvent.click(btn)
    })
    expect(dialog()).toBeNull()
  })

  it('defaultOpen mounts the content immediately', () => {
    render(harness({ defaultOpen: true }))
    expect(dialog()).not.toBeNull()
  })

  it('aria-expanded flips with state', () => {
    const { container } = render(harness())
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    act(() => {
      fireEvent.click(btn)
    })
    expect(btn.getAttribute('aria-expanded')).toBe('true')
  })

  it('aria-controls points at the content id, and matches once open', () => {
    const { container } = render(harness({ defaultOpen: true }))
    const btn = container.querySelector('button')!
    const d = dialog()!
    expect(btn.getAttribute('aria-controls')).toBe(d.id)
  })

  it('controlled open prop overrides internal state', () => {
    const onChange = vi.fn()
    const { container, rerender } = render(harness({ open: false, onOpenChange: onChange }))
    const btn = container.querySelector('button')!
    expect(dialog()).toBeNull()
    rerender(harness({ open: true, onOpenChange: onChange }))
    expect(dialog()).not.toBeNull()
    // Click should call onOpenChange but NOT flip internal state (controlled).
    act(() => {
      fireEvent.click(btn)
    })
    expect(onChange).toHaveBeenCalledWith(false)
    expect(dialog()).not.toBeNull() // still open until parent rerenders with open=false
  })

  it('uncontrolled emits onOpenChange on toggle', () => {
    const onChange = vi.fn()
    const { container } = render(harness({ onOpenChange: onChange }))
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.click(btn)
    })
    expect(onChange).toHaveBeenCalledWith(true)
    act(() => {
      fireEvent.click(btn)
    })
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('outside pointerdown closes the popover', () => {
    const { container } = render(
      <div>
        <div data-testid="outside">outside</div>
        {harness({ defaultOpen: true })}
      </div>,
    )
    expect(dialog()).not.toBeNull()
    const outside = container.querySelector('[data-testid=outside]')!
    act(() => {
      fireEvent.pointerDown(outside)
    })
    expect(dialog()).toBeNull()
  })

  it('pointerdown inside content does not close', () => {
    render(harness({ defaultOpen: true }))
    const d = dialog()!
    act(() => {
      fireEvent.pointerDown(d)
    })
    expect(dialog()).not.toBeNull()
  })

  it('Escape closes the popover', () => {
    render(harness({ defaultOpen: true }))
    expect(dialog()).not.toBeNull()
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(dialog()).toBeNull()
  })

  it('autoFocus moves focus to the content on open', () => {
    const { container } = render(harness())
    const btn = container.querySelector('button')!
    btn.focus()
    act(() => {
      fireEvent.click(btn)
    })
    // queueMicrotask runs synchronously in test env when awaited; flush via Promise.resolve().
    return Promise.resolve().then(() => {
      expect(document.activeElement).toBe(dialog())
    })
  })

  it('restoreFocus returns focus to trigger on close', () => {
    const { container } = render(harness({ defaultOpen: true }))
    const btn = container.querySelector('button')!
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(document.activeElement).toBe(btn)
  })

  it('asChild trigger renders the provided element', () => {
    const { container } = render(
      <IrisPopover>
        <IrisPopoverTrigger asChild>
          <a href="#x">Open</a>
        </IrisPopoverTrigger>
        <IrisPopoverContent>x</IrisPopoverContent>
      </IrisPopover>,
    )
    const link = container.querySelector('a')!
    expect(link).not.toBeNull()
    expect(link.getAttribute('aria-haspopup')).toBe('dialog')
    expect(link.getAttribute('aria-expanded')).toBe('false')
    act(() => {
      fireEvent.click(link)
    })
    expect(link.getAttribute('aria-expanded')).toBe('true')
  })

  it('content uses portal by default (rendered in document.body, not inside the harness container)', () => {
    const { container } = render(harness({ defaultOpen: true }))
    expect(container.querySelector('[role=dialog]')).toBeNull()
    expect(document.body.querySelector('[role=dialog]')).not.toBeNull()
  })

  it('portalTarget={false} renders content inline', () => {
    const { container } = render(
      <IrisPopover defaultOpen>
        <IrisPopoverTrigger>x</IrisPopoverTrigger>
        <IrisPopoverContent portalTarget={false}>
          <div>inline</div>
        </IrisPopoverContent>
      </IrisPopover>,
    )
    expect(container.querySelector('[role=dialog]')).not.toBeNull()
  })

  it('throws when Trigger is used without provider', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IrisPopoverTrigger>x</IrisPopoverTrigger>)).toThrow(
      /must be a descendant of <IrisPopover>/,
    )
    e.mockRestore()
  })

  it('throws when Content is used without provider', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IrisPopoverContent>x</IrisPopoverContent>)).toThrow(
      /must be a descendant of <IrisPopover>/,
    )
    e.mockRestore()
  })
})
