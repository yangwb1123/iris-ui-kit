import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as React from 'react'
import { render } from '@testing-library/react'
import {
  useBodyScrollLock,
  __getBodyScrollLockCount,
  __resetBodyScrollLock,
} from './useBodyScrollLock'

function Locker({ active }: { active: boolean }) {
  useBodyScrollLock(active)
  return null
}

describe('useBodyScrollLock', () => {
  beforeEach(() => {
    __resetBodyScrollLock()
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  })
  afterEach(() => __resetBodyScrollLock())

  it('locks and restores body overflow', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = render(<Locker active />)
    expect(document.body.style.overflow).toBe('hidden')
    expect(__getBodyScrollLockCount()).toBe(1)
    unmount()
    expect(document.body.style.overflow).toBe('auto')
    expect(__getBodyScrollLockCount()).toBe(0)
  })

  it('is reference-counted across stacked locks', () => {
    const a = render(<Locker active />)
    const b = render(<Locker active />)
    expect(__getBodyScrollLockCount()).toBe(2)
    a.unmount()
    expect(document.body.style.overflow).toBe('hidden') // still locked by b
    b.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('does not clobber a host overflow change made while locked', () => {
    const { unmount } = render(<Locker active />)
    expect(document.body.style.overflow).toBe('hidden')
    // A host (e.g. a route transition) sets its own overflow while locked.
    document.body.style.overflow = 'clip'
    unmount()
    // unlock must respect the host's value, not blindly restore the pre-lock one.
    expect(document.body.style.overflow).toBe('clip')
  })
})
