import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import {
  useBodyScrollLock,
  __getBodyScrollLockCount,
  __resetBodyScrollLock,
} from './useBodyScrollLock'

afterEach(() => {
  cleanup()
  __resetBodyScrollLock()
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
})
