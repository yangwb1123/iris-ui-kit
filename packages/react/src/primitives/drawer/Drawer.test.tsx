import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisDrawer } from './Drawer'
import { IrisDrawerTrigger } from './DrawerTrigger'
import { IrisDrawerContent, IrisDrawerTitle, IrisDrawerClose } from './DrawerContent'
import {
  __resetBodyScrollLock,
  __getBodyScrollLockCount,
} from '../../modal-utils/useBodyScrollLock'

beforeEach(() => {
  __resetBodyScrollLock()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  __resetBodyScrollLock()
})

function harness(props?: {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (next: boolean) => void
  side?: 'left' | 'right' | 'top' | 'bottom'
  size?: string
  closeOnEscape?: boolean
  closeOnOutsideClick?: boolean
  withTitle?: boolean
}) {
  return (
    <IrisDrawer
      open={props?.open}
      defaultOpen={props?.defaultOpen}
      onOpenChange={props?.onOpenChange}
      side={props?.side}
      size={props?.size}
      closeOnEscape={props?.closeOnEscape}
      closeOnOutsideClick={props?.closeOnOutsideClick}
    >
      <IrisDrawerTrigger>Open</IrisDrawerTrigger>
      <IrisDrawerContent>
        {props?.withTitle !== false ? <IrisDrawerTitle>Title</IrisDrawerTitle> : null}
        <input data-testid="first" />
        <IrisDrawerClose>Close</IrisDrawerClose>
      </IrisDrawerContent>
    </IrisDrawer>
  )
}

function dialog(): HTMLElement | null {
  return document.querySelector('[role=dialog]')
}

describe('@iris-ui/react IrisDrawer', () => {
  it('renders only the trigger when closed', () => {
    const { container } = render(harness())
    expect(container.querySelector('button')).not.toBeNull()
    expect(dialog()).toBeNull()
  })

  it('opens via trigger click', () => {
    const { container } = render(harness())
    act(() => {
      fireEvent.click(container.querySelector('button')!)
    })
    expect(dialog()).not.toBeNull()
  })

  it('defaultOpen mounts content immediately', () => {
    render(harness({ defaultOpen: true }))
    expect(dialog()).not.toBeNull()
  })

  it('controlled open prop drives state', () => {
    const { rerender } = render(harness({ open: false }))
    expect(dialog()).toBeNull()
    rerender(harness({ open: true }))
    expect(dialog()).not.toBeNull()
  })

  it('onOpenChange fires on trigger click', () => {
    const onChange = vi.fn()
    const { container } = render(harness({ onOpenChange: onChange }))
    act(() => {
      fireEvent.click(container.querySelector('button')!)
    })
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('role="dialog" + aria-modal="true"', () => {
    render(harness({ defaultOpen: true }))
    const d = dialog()!
    expect(d.getAttribute('role')).toBe('dialog')
    expect(d.getAttribute('aria-modal')).toBe('true')
  })

  it('aria-labelledby points to Title when present', () => {
    render(harness({ defaultOpen: true }))
    const d = dialog()!
    const labelId = d.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId!)?.textContent).toBe('Title')
  })

  it('omits aria-labelledby when no Title is mounted', () => {
    render(harness({ defaultOpen: true, withTitle: false }))
    const d = dialog()!
    expect(d.getAttribute('aria-labelledby')).toBeNull()
  })

  it('side prop reflects on data-iris-drawer-side', () => {
    render(harness({ defaultOpen: true, side: 'left' }))
    const d = dialog()!
    expect(d.getAttribute('data-iris-drawer-side')).toBe('left')
  })

  it('Escape closes when closeOnEscape (default)', () => {
    const onChange = vi.fn()
    render(harness({ defaultOpen: true, onOpenChange: onChange }))
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('closeOnEscape=false ignores Escape', () => {
    const onChange = vi.fn()
    render(harness({ defaultOpen: true, closeOnEscape: false, onOpenChange: onChange }))
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('backdrop click closes by default', () => {
    const onChange = vi.fn()
    render(harness({ defaultOpen: true, onOpenChange: onChange }))
    const backdrop = document.querySelector('[data-iris-drawer-backdrop]')!
    act(() => {
      fireEvent.click(backdrop)
    })
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('closeOnOutsideClick=false ignores backdrop click', () => {
    const onChange = vi.fn()
    render(harness({ defaultOpen: true, closeOnOutsideClick: false, onOpenChange: onChange }))
    const backdrop = document.querySelector('[data-iris-drawer-backdrop]')!
    act(() => {
      fireEvent.click(backdrop)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('close button calls setOpen(false)', () => {
    const onChange = vi.fn()
    render(harness({ defaultOpen: true, onOpenChange: onChange }))
    const closeBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Close',
    )!
    act(() => {
      fireEvent.click(closeBtn)
    })
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('keeps content mounted during exit animation, then unmounts', () => {
    const { rerender } = render(harness({ open: true }))
    expect(dialog()).not.toBeNull()
    rerender(harness({ open: false }))
    // Still mounted during the 220ms exit transition.
    expect(dialog()).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(220)
    })
    expect(dialog()).toBeNull()
  })

  it('body scroll lock engages on open, releases on close', () => {
    expect(__getBodyScrollLockCount()).toBe(0)
    const { rerender } = render(harness({ open: true }))
    expect(__getBodyScrollLockCount()).toBe(1)
    rerender(harness({ open: false }))
    expect(__getBodyScrollLockCount()).toBe(0)
  })

  it('content portaled to document.body by default', () => {
    const { container } = render(harness({ defaultOpen: true }))
    expect(container.querySelector('[role=dialog]')).toBeNull()
    expect(document.body.querySelector('[role=dialog]')).not.toBeNull()
  })

  it('portalTarget={false} renders inline', () => {
    const { container } = render(
      <IrisDrawer defaultOpen>
        <IrisDrawerTrigger>x</IrisDrawerTrigger>
        <IrisDrawerContent portalTarget={false}>
          <p>inline</p>
        </IrisDrawerContent>
      </IrisDrawer>,
    )
    expect(container.querySelector('[role=dialog]')).not.toBeNull()
  })

  it('Trigger outside provider throws', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IrisDrawerTrigger>x</IrisDrawerTrigger>)).toThrow(
      /must be a descendant of <IrisDrawer>/,
    )
    e.mockRestore()
  })

  it('Content outside provider throws', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IrisDrawerContent>x</IrisDrawerContent>)).toThrow(
      /must be a descendant of <IrisDrawer>/,
    )
    e.mockRestore()
  })

  it('bottom panel padding carries safe-area inset (mobile home-bar clearance)', () => {
    render(harness({ defaultOpen: true, side: 'bottom' }))
    const panel = dialog()!
    expect(panel.style.paddingBottom).toContain('env(safe-area-inset-bottom')
  })
})
