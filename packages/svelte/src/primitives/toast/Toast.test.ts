import { render, fireEvent, createEvent, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import IrisToastViewport from './IrisToastViewport.svelte'
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

// jsdom's PointerEvent drops clientX from its init, so build the event and
// define clientX explicitly to drive the swipe handlers.
async function swipePointer(
  node: Element,
  kind: 'pointerDown' | 'pointerMove' | 'pointerUp',
  clientX: number,
): Promise<void> {
  const ev = createEvent[kind](node, { pointerId: 1 })
  Object.defineProperty(ev, 'clientX', { value: clientX, configurable: true })
  await fireEvent(node, ev)
}

describe('@iris-ui/svelte IrisToast', () => {
  it('renders viewport and shows nothing when queue is empty', () => {
    render(IrisToastViewport)
    flushSync()
    expect(toasts().length).toBe(0)
  })

  it('pushToast adds a toast that appears in the viewport', () => {
    render(IrisToastViewport)
    pushToast({ title: 'Hello' })
    flushSync()
    const list = toasts()
    expect(list.length).toBe(1)
    expect(list[0]?.textContent).toContain('Hello')
  })

  it('swiping a toast past the threshold dismisses it', async () => {
    render(IrisToastViewport)
    pushToast({ title: 'Swipe me', duration: Infinity })
    flushSync()
    const toast = toasts()[0]!
    await swipePointer(toast, 'pointerDown', 0)
    await swipePointer(toast, 'pointerMove', 140)
    await swipePointer(toast, 'pointerUp', 140)
    flushSync()
    expect(toasts().length).toBe(0)
  })

  it('releasing a small swipe (below threshold) keeps the toast', async () => {
    render(IrisToastViewport)
    pushToast({ title: 'Keep me', duration: Infinity })
    flushSync()
    const toast = toasts()[0]!
    await swipePointer(toast, 'pointerDown', 0)
    await swipePointer(toast, 'pointerMove', 30)
    await swipePointer(toast, 'pointerUp', 30)
    flushSync()
    expect(toasts().length).toBe(1)
  })

  it('renders title and description', () => {
    render(IrisToastViewport)
    pushToast({ title: 'Saved', description: 'Your changes are live' })
    flushSync()
    const t = toasts()[0]!
    expect(t.textContent).toContain('Saved')
    expect(t.textContent).toContain('Your changes are live')
  })

  it('variant=error sets role="alert" with aria-live="assertive"', () => {
    render(IrisToastViewport)
    pushToast({ title: 'Boom', variant: 'error' })
    flushSync()
    const t = toasts()[0]!
    expect(t.getAttribute('role')).toBe('alert')
    expect(t.getAttribute('aria-live')).toBe('assertive')
    expect(t.getAttribute('data-variant')).toBe('error')
  })

  it('non-error variants use role="status" + polite', () => {
    render(IrisToastViewport)
    pushToast({ title: 'ok', variant: 'success' })
    flushSync()
    const t = toasts()[0]!
    expect(t.getAttribute('role')).toBe('status')
    expect(t.getAttribute('aria-live')).toBe('polite')
  })

  it('auto-dismisses after duration', () => {
    render(IrisToastViewport)
    pushToast({ title: 'temp', duration: 500 })
    flushSync()
    expect(toasts().length).toBe(1)
    vi.advanceTimersByTime(500)
    flushSync()
    expect(toasts().length).toBe(0)
  })

  it('duration=0 keeps toast persistent', () => {
    render(IrisToastViewport)
    pushToast({ title: 'sticky', duration: 0 })
    flushSync()
    vi.advanceTimersByTime(10_000)
    flushSync()
    expect(toasts().length).toBe(1)
  })

  it('Dismiss button removes the toast', async () => {
    render(IrisToastViewport)
    pushToast({ title: 'x' })
    flushSync()
    const t = toasts()[0]!
    await fireEvent.click(dismissButtonFor(t))
    flushSync()
    expect(toasts().length).toBe(0)
  })

  it('hovering pauses auto-dismiss; unhovering resumes', async () => {
    render(IrisToastViewport)
    pushToast({ title: 'x', duration: 1000 })
    flushSync()
    const viewport = document.querySelector('[data-iris-toast-viewport]')!
    await fireEvent.pointerEnter(viewport)
    vi.advanceTimersByTime(900)
    flushSync()
    expect(toasts().length).toBe(1) // not dismissed while hovered
    await fireEvent.pointerLeave(viewport)
    vi.advanceTimersByTime(1500)
    flushSync()
    expect(toasts().length).toBe(0)
  })

  it('reusing an id replaces the toast in place', () => {
    render(IrisToastViewport)
    pushToast({ id: 'fixed', title: 'first' })
    flushSync()
    expect(toasts().length).toBe(1)
    pushToast({ id: 'fixed', title: 'second' })
    flushSync()
    expect(toasts().length).toBe(1)
    expect(toasts()[0]?.textContent).toContain('second')
  })

  it('clearToasts empties the queue', () => {
    render(IrisToastViewport)
    pushToast({ title: 'a' })
    pushToast({ title: 'b' })
    flushSync()
    expect(toasts().length).toBe(2)
    clearToasts()
    flushSync()
    expect(toasts().length).toBe(0)
  })

  it('max prop trims older toasts', () => {
    render(IrisToastViewport, { props: { max: 2 } })
    pushToast({ title: '1' })
    pushToast({ title: '2' })
    pushToast({ title: '3' })
    flushSync()
    expect(toasts().length).toBe(2)
    // Trimming keeps the LATEST entries, so '2' and '3' should remain.
    expect(toasts()[0]?.textContent).toContain('2')
    expect(toasts()[1]?.textContent).toContain('3')
  })

  it('action button runs handler and dismisses the toast', async () => {
    const onClick = vi.fn()
    render(IrisToastViewport)
    pushToast({ title: 'x', action: { label: 'Undo', onClick } })
    flushSync()
    const t = toasts()[0]!
    const actionBtn = Array.from(t.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Undo',
    )!
    await fireEvent.click(actionBtn)
    flushSync()
    expect(onClick).toHaveBeenCalledOnce()
    expect(toasts().length).toBe(0)
  })

  it('viewport portals to document.body by default', () => {
    const { container } = render(IrisToastViewport)
    pushToast({ title: 'x' })
    flushSync()
    expect(container.querySelector('[data-iris-toast]')).toBeNull()
    expect(document.body.querySelector('[data-iris-toast]')).not.toBeNull()
  })

  it('portalTarget={false} renders inline', () => {
    const { container } = render(IrisToastViewport, { props: { portalTarget: false } })
    pushToast({ title: 'x' })
    flushSync()
    expect(container.querySelector('[data-iris-toast]')).not.toBeNull()
  })

  it('position prop reflects on data-position', () => {
    render(IrisToastViewport, { props: { position: 'bottom-center' } })
    flushSync()
    const viewport = document.querySelector('[data-iris-toast-viewport]')!
    expect(viewport.getAttribute('data-position')).toBe('bottom-center')
  })

  it('useToast.success pushes with variant=success', () => {
    render(IrisToastViewport)
    const toast = useToast()
    toast.success({ title: 'yay' })
    flushSync()
    expect(toasts()[0]?.getAttribute('data-variant')).toBe('success')
  })

  it('useToast.dismiss removes the toast by id', () => {
    render(IrisToastViewport)
    const toast = useToast()
    const id = toast.push({ title: 'temp', duration: 0 })
    toast.dismiss(id)
    flushSync()
    expect(toasts().length).toBe(0)
  })

  it('getToasts reflects current queue', () => {
    expect(getToasts()).toEqual([])
    pushToast({ title: 'x' })
    expect(getToasts().length).toBe(1)
  })
})
