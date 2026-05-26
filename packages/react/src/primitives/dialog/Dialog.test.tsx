import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisDialog } from './Dialog'
import { IrisDialogTrigger } from './DialogTrigger'
import {
  IrisDialogContent,
  IrisDialogTitle,
  IrisDialogDescription,
  IrisDialogClose,
} from './DialogContent'
import { __resetBodyScrollLock, __getBodyScrollLockCount } from '../../modal-utils/useBodyScrollLock'

beforeEach(() => {
  __resetBodyScrollLock()
})

afterEach(() => {
  cleanup()
  __resetBodyScrollLock()
})

function harness(props?: {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (next: boolean) => void
  closeOnOutsideClick?: boolean
  closeOnEscape?: boolean
  withTitle?: boolean
  withDescription?: boolean
}) {
  return (
    <IrisDialog
      defaultOpen={props?.defaultOpen}
      open={props?.open}
      onOpenChange={props?.onOpenChange}
      closeOnOutsideClick={props?.closeOnOutsideClick}
      closeOnEscape={props?.closeOnEscape}
    >
      <IrisDialogTrigger>Open</IrisDialogTrigger>
      <IrisDialogContent>
        {props?.withTitle !== false ? <IrisDialogTitle>Title</IrisDialogTitle> : null}
        {props?.withDescription !== false ? (
          <IrisDialogDescription>Desc</IrisDialogDescription>
        ) : null}
        <input data-testid="first-input" />
        <button type="button" data-testid="last-button">
          Action
        </button>
        <IrisDialogClose>Close</IrisDialogClose>
      </IrisDialogContent>
    </IrisDialog>
  )
}

function dialog(): HTMLElement | null {
  return document.querySelector('[role=dialog]')
}

describe('@iris-ui/react IrisDialog', () => {
  it('renders only the trigger when closed', () => {
    const { container } = render(harness())
    expect(container.querySelector('button')).not.toBeNull()
    expect(dialog()).toBeNull()
  })

  it('opens via trigger click (uncontrolled)', () => {
    const { container } = render(harness())
    act(() => {
      fireEvent.click(container.querySelector('button')!)
    })
    expect(dialog()).not.toBeNull()
  })

  it('defaultOpen renders the content immediately', () => {
    render(harness({ defaultOpen: true }))
    expect(dialog()).not.toBeNull()
  })

  it('uncontrolled onOpenChange fires on trigger click', () => {
    const onChange = vi.fn()
    const { container } = render(harness({ onOpenChange: onChange }))
    act(() => {
      fireEvent.click(container.querySelector('button')!)
    })
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('controlled open prop drives state', () => {
    const { rerender } = render(harness({ open: false }))
    expect(dialog()).toBeNull()
    rerender(harness({ open: true }))
    expect(dialog()).not.toBeNull()
  })

  it('role="dialog" + aria-modal="true" on the modal surface', () => {
    render(harness({ defaultOpen: true }))
    const d = dialog()!
    expect(d.getAttribute('role')).toBe('dialog')
    expect(d.getAttribute('aria-modal')).toBe('true')
  })

  it('aria-labelledby points to the title when present', () => {
    render(harness({ defaultOpen: true }))
    const d = dialog()!
    const labelId = d.getAttribute('aria-labelledby')
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId!)?.textContent).toBe('Title')
  })

  it('aria-describedby points to the description when present', () => {
    render(harness({ defaultOpen: true }))
    const d = dialog()!
    const descId = d.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    expect(document.getElementById(descId!)?.textContent).toBe('Desc')
  })

  it('omits aria-labelledby when no Title is mounted', () => {
    render(harness({ defaultOpen: true, withTitle: false }))
    const d = dialog()!
    expect(d.getAttribute('aria-labelledby')).toBeNull()
  })

  it('Escape closes the dialog when closeOnEscape (default)', () => {
    render(harness({ defaultOpen: true }))
    expect(dialog()).not.toBeNull()
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(dialog()).toBeNull()
  })

  it('closeOnEscape=false ignores Escape', () => {
    render(harness({ defaultOpen: true, closeOnEscape: false }))
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(dialog()).not.toBeNull()
  })

  it('backdrop pointerdown closes the dialog by default', () => {
    render(harness({ defaultOpen: true }))
    const backdrop = document.querySelector('[data-iris-dialog-backdrop]')!
    act(() => {
      fireEvent.pointerDown(backdrop)
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

  it('closeOnOutsideClick=false ignores backdrop click', () => {
    render(harness({ defaultOpen: true, closeOnOutsideClick: false }))
    const backdrop = document.querySelector('[data-iris-dialog-backdrop]')!
    act(() => {
      fireEvent.pointerDown(backdrop)
    })
    expect(dialog()).not.toBeNull()
  })

  it('IrisDialogClose closes the dialog on click', () => {
    render(harness({ defaultOpen: true }))
    const closeBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Close',
    )!
    act(() => {
      fireEvent.click(closeBtn)
    })
    expect(dialog()).toBeNull()
  })

  it('body scroll lock engages on open and releases on close', () => {
    expect(__getBodyScrollLockCount()).toBe(0)
    const { rerender } = render(harness({ open: true }))
    expect(__getBodyScrollLockCount()).toBe(1)
    expect(document.body.style.overflow).toBe('hidden')
    rerender(harness({ open: false }))
    expect(__getBodyScrollLockCount()).toBe(0)
    expect(document.body.style.overflow).toBe('')
  })

  it('stacked dialogs reference-count the body scroll lock', () => {
    const Both = ({ a, b }: { a: boolean; b: boolean }) => (
      <>
        <IrisDialog open={a}>
          <IrisDialogTrigger>A</IrisDialogTrigger>
          <IrisDialogContent>
            <p>A</p>
          </IrisDialogContent>
        </IrisDialog>
        <IrisDialog open={b}>
          <IrisDialogTrigger>B</IrisDialogTrigger>
          <IrisDialogContent>
            <p>B</p>
          </IrisDialogContent>
        </IrisDialog>
      </>
    )
    const { rerender } = render(<Both a={true} b={false} />)
    expect(__getBodyScrollLockCount()).toBe(1)
    rerender(<Both a={true} b={true} />)
    expect(__getBodyScrollLockCount()).toBe(2)
    rerender(<Both a={false} b={true} />)
    expect(__getBodyScrollLockCount()).toBe(1)
    rerender(<Both a={false} b={false} />)
    expect(__getBodyScrollLockCount()).toBe(0)
  })

  it('content is portaled to document.body by default', () => {
    const { container } = render(harness({ defaultOpen: true }))
    expect(container.querySelector('[role=dialog]')).toBeNull()
    expect(document.body.querySelector('[role=dialog]')).not.toBeNull()
  })

  it('portalTarget={false} renders inline', () => {
    const { container } = render(
      <IrisDialog defaultOpen>
        <IrisDialogTrigger>x</IrisDialogTrigger>
        <IrisDialogContent portalTarget={false}>
          <p>inline</p>
        </IrisDialogContent>
      </IrisDialog>,
    )
    expect(container.querySelector('[role=dialog]')).not.toBeNull()
  })

  it('asChild trigger renders the provided element', () => {
    const { container } = render(
      <IrisDialog>
        <IrisDialogTrigger asChild>
          <a href="#x">Open</a>
        </IrisDialogTrigger>
        <IrisDialogContent>x</IrisDialogContent>
      </IrisDialog>,
    )
    const link = container.querySelector('a')!
    expect(link.getAttribute('aria-haspopup')).toBe('dialog')
    act(() => {
      fireEvent.click(link)
    })
    expect(dialog()).not.toBeNull()
  })

  it('Trigger outside provider throws', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IrisDialogTrigger>x</IrisDialogTrigger>)).toThrow(
      /must be a descendant of <IrisDialog>/,
    )
    e.mockRestore()
  })

  it('Content outside provider throws', () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<IrisDialogContent>x</IrisDialogContent>)).toThrow(
      /must be a descendant of <IrisDialog>/,
    )
    e.mockRestore()
  })
})
