import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { useDismiss, type UseDismissOptions } from './useDismiss'

afterEach(cleanup)

function Harness({
  enabled = true,
  escape,
  outsidePointerDown,
  onDismiss,
}: Partial<UseDismissOptions> & { onDismiss: () => void }) {
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  useDismiss({
    enabled,
    exclude: [triggerRef, contentRef],
    onDismiss,
    escape,
    outsidePointerDown,
  })
  return (
    <div>
      <button ref={triggerRef} data-testid="trigger">
        trigger
      </button>
      <div ref={contentRef} data-testid="content">
        <span data-testid="inner">inner</span>
      </div>
      <div data-testid="outside">outside</div>
    </div>
  )
}

describe('useDismiss (react)', () => {
  it('fires onDismiss on outside pointerdown', () => {
    const onDismiss = vi.fn()
    const { getByTestId } = render(<Harness onDismiss={onDismiss} />)
    fireEvent.pointerDown(getByTestId('outside'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not fire when pointerdown is on the trigger or inside content', () => {
    const onDismiss = vi.fn()
    const { getByTestId } = render(<Harness onDismiss={onDismiss} />)
    fireEvent.pointerDown(getByTestId('trigger'))
    fireEvent.pointerDown(getByTestId('content'))
    fireEvent.pointerDown(getByTestId('inner'))
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('fires onDismiss on Escape', () => {
    const onDismiss = vi.fn()
    render(<Harness onDismiss={onDismiss} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('is inert while disabled', () => {
    const onDismiss = vi.fn()
    const { getByTestId } = render(<Harness enabled={false} onDismiss={onDismiss} />)
    fireEvent.pointerDown(getByTestId('outside'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('honors the escape and outsidePointerDown flags', () => {
    const onDismiss = vi.fn()
    const { getByTestId } = render(
      <Harness onDismiss={onDismiss} escape={false} outsidePointerDown={true} />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.pointerDown(getByTestId('outside'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('detaches listeners on unmount', () => {
    const onDismiss = vi.fn()
    const { getByTestId, unmount } = render(<Harness onDismiss={onDismiss} />)
    const outside = getByTestId('outside')
    unmount()
    fireEvent.pointerDown(outside)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
