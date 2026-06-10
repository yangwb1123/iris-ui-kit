import { describe, it, expect, afterEach, vi } from 'vitest'
import { render } from '@testing-library/svelte'
import {
  useBodyScrollLock,
  __getBodyScrollLockCount,
  __resetBodyScrollLock,
} from './useBodyScrollLock.svelte'
import FocusTrapHarness from './FocusTrapHarness.svelte'

afterEach(() => {
  __resetBodyScrollLock()
  vi.restoreAllMocks()
})

describe('useBodyScrollLock', () => {
  it('locks body scroll on lockScroll()', () => {
    const { lockScroll } = useBodyScrollLock()
    lockScroll()
    expect(document.body.style.overflow).toBe('hidden')
    expect(__getBodyScrollLockCount()).toBe(1)
  })

  it('unlocks body scroll on unlockScroll()', () => {
    const { lockScroll, unlockScroll } = useBodyScrollLock()
    lockScroll()
    unlockScroll()
    expect(document.body.style.overflow).toBe('')
    expect(__getBodyScrollLockCount()).toBe(0)
  })

  it('locks and restores the host overflow value', () => {
    document.body.style.overflow = 'auto'
    const { lockScroll, unlockScroll } = useBodyScrollLock()
    lockScroll()
    expect(document.body.style.overflow).toBe('hidden')
    unlockScroll()
    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })

  it('reference counts multiple locks', () => {
    const a = useBodyScrollLock()
    const b = useBodyScrollLock()
    a.lockScroll()
    b.lockScroll()
    expect(__getBodyScrollLockCount()).toBe(2)
    a.unlockScroll()
    expect(__getBodyScrollLockCount()).toBe(1)
    expect(document.body.style.overflow).toBe('hidden')
    b.unlockScroll()
    expect(document.body.style.overflow).toBe('')
  })

  it('does not double-lock from same instance', () => {
    const { lockScroll } = useBodyScrollLock()
    lockScroll()
    lockScroll()
    expect(__getBodyScrollLockCount()).toBe(1)
  })

  it('does not clobber a host overflow change made while locked', () => {
    const { lockScroll, unlockScroll } = useBodyScrollLock()
    lockScroll()
    expect(document.body.style.overflow).toBe('hidden')
    // A host (e.g. a route transition) sets its own overflow while locked.
    document.body.style.overflow = 'clip'
    unlockScroll()
    // unlock must respect the host's value, not blindly restore the pre-lock one.
    expect(document.body.style.overflow).toBe('clip')
    document.body.style.overflow = ''
  })
})

/** Run the next requestAnimationFrame callback. */
function flushRaf(): Promise<void> {
  return new Promise<void>((r) => requestAnimationFrame(() => r()))
}

describe('useFocusTrap restore guard', () => {
  it('restores focus to a still-connected trigger', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = render(FocusTrapHarness, {
      props: { active: true, returnFocusTo: trigger },
    })
    unmount()
    await flushRaf()

    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('does not call focus() on a detached restore target', async () => {
    const detached = document.createElement('button')
    // never appended to the document → isConnected === false
    const focusSpy = vi.spyOn(detached, 'focus')

    const { unmount } = render(FocusTrapHarness, {
      props: { active: true, returnFocusTo: detached },
    })
    unmount()
    await flushRaf()

    expect(focusSpy).not.toHaveBeenCalled()
  })
})
