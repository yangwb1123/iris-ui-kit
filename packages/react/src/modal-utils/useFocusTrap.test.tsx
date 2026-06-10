import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { render } from '@testing-library/react'
import { useFocusTrap } from './useFocusTrap'

function Trap({
  active,
  returnFocusTo,
}: {
  active: boolean
  returnFocusTo?: React.RefObject<HTMLElement | null | undefined>
}) {
  const container = React.useRef<HTMLDivElement | null>(null)
  useFocusTrap({ container, active, returnFocusTo, initialFocus: false })
  return (
    <div ref={container}>
      <button type="button">inside</button>
    </div>
  )
}

/** Run the next requestAnimationFrame callback synchronously. */
async function flushRaf() {
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
}

describe('useFocusTrap restore guard', () => {
  afterEach(() => vi.restoreAllMocks())

  it('restores focus to a still-connected trigger', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = render(<Trap active />)
    unmount()
    await flushRaf()

    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('does not call focus() on a detached restore target', async () => {
    const detached = document.createElement('button')
    // never appended to the document → isConnected === false
    const focusSpy = vi.spyOn(detached, 'focus')
    const ref = { current: detached } as React.RefObject<HTMLElement | null | undefined>

    const { unmount } = render(<Trap active returnFocusTo={ref} />)
    unmount()
    await flushRaf()

    expect(focusSpy).not.toHaveBeenCalled()
  })
})
