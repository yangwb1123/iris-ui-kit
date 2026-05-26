import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisToastViewport } from './ToastViewport'
import { useToast } from './useToast'
import { clearToasts, getToasts, pushToast } from './toastStore'

beforeEach(() => {
  clearToasts()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  clearToasts()
})

function toasts(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-toast]'))
}

function dismissButtonFor(toast: HTMLElement): HTMLButtonElement {
  return toast.querySelector('button[aria-label=Dismiss]') as HTMLButtonElement
}

describe('@iris-ui/react IrisToast', () => {
  it('renders viewport and shows nothing when queue is empty', () => {
    render(<IrisToastViewport />)
    expect(toasts().length).toBe(0)
  })

  it('pushToast adds a toast that appears in the viewport', () => {
    render(<IrisToastViewport />)
    act(() => {
      pushToast({ title: 'Hello' })
    })
    const list = toasts()
    expect(list.length).toBe(1)
    expect(list[0]?.textContent).toContain('Hello')
  })

  it('renders title and description', () => {
    render(<IrisToastViewport />)
    act(() => {
      pushToast({ title: 'Saved', description: 'Your changes are live' })
    })
    const t = toasts()[0]!
    expect(t.textContent).toContain('Saved')
    expect(t.textContent).toContain('Your changes are live')
  })

  it('variant=error sets role="alert" with aria-live="assertive"', () => {
    render(<IrisToastViewport />)
    act(() => {
      pushToast({ title: 'Boom', variant: 'error' })
    })
    const t = toasts()[0]!
    expect(t.getAttribute('role')).toBe('alert')
    expect(t.getAttribute('aria-live')).toBe('assertive')
    expect(t.getAttribute('data-variant')).toBe('error')
  })

  it('non-error variants use role="status" + polite', () => {
    render(<IrisToastViewport />)
    act(() => {
      pushToast({ title: 'ok', variant: 'success' })
    })
    const t = toasts()[0]!
    expect(t.getAttribute('role')).toBe('status')
    expect(t.getAttribute('aria-live')).toBe('polite')
  })

  it('auto-dismisses after duration', () => {
    render(<IrisToastViewport />)
    act(() => {
      pushToast({ title: 'temp', duration: 500 })
    })
    expect(toasts().length).toBe(1)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(toasts().length).toBe(0)
  })

  it('duration=0 keeps toast persistent', () => {
    render(<IrisToastViewport />)
    act(() => {
      pushToast({ title: 'sticky', duration: 0 })
    })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(toasts().length).toBe(1)
  })

  it('Dismiss button removes the toast', () => {
    render(<IrisToastViewport />)
    act(() => {
      pushToast({ title: 'x' })
    })
    const t = toasts()[0]!
    act(() => {
      fireEvent.click(dismissButtonFor(t))
    })
    expect(toasts().length).toBe(0)
  })

  it('hovering pauses auto-dismiss; unhovering resumes', () => {
    render(<IrisToastViewport />)
    act(() => {
      pushToast({ title: 'x', duration: 1000 })
    })
    const viewport = document.querySelector('[data-iris-toast-viewport]')!
    act(() => {
      fireEvent.pointerEnter(viewport)
      vi.advanceTimersByTime(900)
    })
    expect(toasts().length).toBe(1) // not dismissed while hovered
    act(() => {
      fireEvent.pointerLeave(viewport)
    })
    act(() => {
      // Remaining = max(0, createdAt+duration - now). With shouldAdvanceTime,
      // we're already past duration, so it should fire on the next tick.
      vi.advanceTimersByTime(1500)
    })
    expect(toasts().length).toBe(0)
  })

  it('reusing an id replaces the toast in place', () => {
    render(<IrisToastViewport />)
    act(() => {
      pushToast({ id: 'fixed', title: 'first' })
    })
    expect(toasts().length).toBe(1)
    act(() => {
      pushToast({ id: 'fixed', title: 'second' })
    })
    expect(toasts().length).toBe(1)
    expect(toasts()[0]?.textContent).toContain('second')
  })

  it('clearToasts empties the queue', () => {
    render(<IrisToastViewport />)
    act(() => {
      pushToast({ title: 'a' })
      pushToast({ title: 'b' })
    })
    expect(toasts().length).toBe(2)
    act(() => {
      clearToasts()
    })
    expect(toasts().length).toBe(0)
  })

  it('max prop trims older toasts', () => {
    render(<IrisToastViewport max={2} />)
    act(() => {
      pushToast({ title: '1' })
      pushToast({ title: '2' })
      pushToast({ title: '3' })
    })
    expect(toasts().length).toBe(2)
    // Trimming keeps the LATEST entries, so '2' and '3' should remain.
    expect(toasts()[0]?.textContent).toContain('2')
    expect(toasts()[1]?.textContent).toContain('3')
  })

  it('action button runs handler and dismisses the toast', () => {
    const onClick = vi.fn()
    render(<IrisToastViewport />)
    act(() => {
      pushToast({ title: 'x', action: { label: 'Undo', onClick } })
    })
    const t = toasts()[0]!
    const actionBtn = Array.from(t.querySelectorAll('button')).find(
      (b) => b.textContent === 'Undo',
    )!
    act(() => {
      fireEvent.click(actionBtn)
    })
    expect(onClick).toHaveBeenCalledOnce()
    expect(toasts().length).toBe(0)
  })

  it('viewport portals to document.body by default', () => {
    const { container } = render(<IrisToastViewport />)
    act(() => {
      pushToast({ title: 'x' })
    })
    expect(container.querySelector('[data-iris-toast]')).toBeNull()
    expect(document.body.querySelector('[data-iris-toast]')).not.toBeNull()
  })

  it('portalTarget={false} renders inline', () => {
    const { container } = render(<IrisToastViewport portalTarget={false} />)
    act(() => {
      pushToast({ title: 'x' })
    })
    expect(container.querySelector('[data-iris-toast]')).not.toBeNull()
  })

  it('position prop reflects on data-position', () => {
    render(<IrisToastViewport position="bottom-center" />)
    const viewport = document.querySelector('[data-iris-toast-viewport]')!
    expect(viewport.getAttribute('data-position')).toBe('bottom-center')
  })

  it('useToast.success pushes with variant=success', () => {
    function HookHarness() {
      const toast = useToast()
      React.useEffect(() => {
        toast.success({ title: 'yay' })
      }, [toast])
      return null
    }
    render(
      <>
        <HookHarness />
        <IrisToastViewport />
      </>,
    )
    expect(toasts()[0]?.getAttribute('data-variant')).toBe('success')
  })

  it('useToast.dismiss removes the toast by id', () => {
    function HookHarness() {
      const toast = useToast()
      React.useEffect(() => {
        const id = toast.push({ title: 'temp', duration: 0 })
        toast.dismiss(id)
      }, [toast])
      return null
    }
    render(
      <>
        <HookHarness />
        <IrisToastViewport />
      </>,
    )
    expect(toasts().length).toBe(0)
  })

  it('getToasts reflects current queue', () => {
    expect(getToasts()).toEqual([])
    act(() => {
      pushToast({ title: 'x' })
    })
    expect(getToasts().length).toBe(1)
  })
})
