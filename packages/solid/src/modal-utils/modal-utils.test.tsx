import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { createSignal, type Accessor } from 'solid-js'
import {
  useBodyScrollLock,
  __getBodyScrollLockCount,
  __resetBodyScrollLock,
} from './useBodyScrollLock'
import { useFocusTrap } from './useFocusTrap'

afterEach(() => {
  cleanup()
  __resetBodyScrollLock()
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
  vi.restoreAllMocks()
})

function BodyScrollLockTest(props: { active: boolean }) {
  const [active] = createSignal(props.active)
  useBodyScrollLock(active)
  return <div data-testid="container">content</div>
}

describe('useBodyScrollLock', () => {
  it('locks body scroll when active', () => {
    render(() => <BodyScrollLockTest active={true} />)
    expect(document.body.style.overflow).toBe('hidden')
    expect(__getBodyScrollLockCount()).toBe(1)
  })

  it('does not lock body scroll when inactive', () => {
    render(() => <BodyScrollLockTest active={false} />)
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(__getBodyScrollLockCount()).toBe(0)
  })

  it('reference counts multiple locks', () => {
    render(() => (
      <>
        <BodyScrollLockTest active={true} />
        <BodyScrollLockTest active={true} />
      </>
    ))
    expect(__getBodyScrollLockCount()).toBe(2)
  })

  it('locks and restores body overflow', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = render(() => <BodyScrollLockTest active={true} />)
    expect(document.body.style.overflow).toBe('hidden')
    expect(__getBodyScrollLockCount()).toBe(1)
    unmount()
    expect(document.body.style.overflow).toBe('auto')
    expect(__getBodyScrollLockCount()).toBe(0)
  })

  it('is reference-counted across stacked locks', () => {
    const a = render(() => <BodyScrollLockTest active={true} />)
    const b = render(() => <BodyScrollLockTest active={true} />)
    expect(__getBodyScrollLockCount()).toBe(2)
    a.unmount()
    expect(document.body.style.overflow).toBe('hidden') // still locked by b
    b.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('does not clobber a host overflow change made while locked', () => {
    const { unmount } = render(() => <BodyScrollLockTest active={true} />)
    expect(document.body.style.overflow).toBe('hidden')
    // A host (e.g. a route transition) sets its own overflow while locked.
    document.body.style.overflow = 'clip'
    unmount()
    // unlock must respect the host's value, not blindly restore the pre-lock one.
    expect(document.body.style.overflow).toBe('clip')
  })
})

/** Run the next requestAnimationFrame callback. */
function flushRaf(): Promise<void> {
  return new Promise<void>((r) => requestAnimationFrame(() => r()))
}

function FocusTrapTest(props: {
  active: boolean
  returnFocusTo?: Accessor<HTMLElement | null | undefined>
}) {
  let container: HTMLDivElement | undefined
  useFocusTrap({
    container: () => container ?? null,
    active: () => props.active,
    returnFocusTo: props.returnFocusTo,
    initialFocus: false,
  })
  return (
    <div ref={container}>
      <button type="button">inside</button>
    </div>
  )
}

describe('useFocusTrap restore guard', () => {
  it('restores focus to a still-connected trigger', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = render(() => <FocusTrapTest active={true} />)
    unmount()
    await flushRaf()

    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('does not call focus() on a detached restore target', async () => {
    const detached = document.createElement('button')
    // never appended to the document → isConnected === false
    const focusSpy = vi.spyOn(detached, 'focus')
    const ref: Accessor<HTMLElement | null | undefined> = () => detached

    const { unmount } = render(() => <FocusTrapTest active={true} returnFocusTo={ref} />)
    unmount()
    await flushRaf()

    expect(focusSpy).not.toHaveBeenCalled()
  })
})
