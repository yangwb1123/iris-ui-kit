import { describe, it, expect, afterEach } from 'vitest'
import {
  useBodyScrollLock,
  __getBodyScrollLockCount,
  __resetBodyScrollLock,
} from './useBodyScrollLock.svelte'

afterEach(() => {
  __resetBodyScrollLock()
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
})
