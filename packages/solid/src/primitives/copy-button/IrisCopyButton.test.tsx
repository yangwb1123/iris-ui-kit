import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { setClipboardHandler } from '@iris-ui-kit/core'
import { IrisCopyButton } from './IrisCopyButton'

afterEach(() => {
  cleanup()
  setClipboardHandler(null)
})

describe('IrisCopyButton', () => {
  it('renders with default label', () => {
    const { getByText } = render(() => <IrisCopyButton text="hello" />)
    expect(getByText('Copy')).toBeTruthy()
  })

  it('renders custom children', () => {
    const { getByText } = render(() => <IrisCopyButton text="hello">Copy Code</IrisCopyButton>)
    expect(getByText('Copy Code')).toBeTruthy()
  })

  it('shows copied state on click', async () => {
    const { container } = render(() => <IrisCopyButton text="hello" />)
    const btn = container.querySelector('[data-iris-copy-button]') as HTMLButtonElement
    fireEvent.click(btn)
    await new Promise((r) => setTimeout(r, 0))
    expect(btn.getAttribute('data-copied')).toBe('true')
    expect(btn.textContent).toBe('Copied')
  })

  it('uses custom copiedLabel', async () => {
    const { container } = render(() => <IrisCopyButton text="hi" copiedLabel="Done!" />)
    const btn = container.querySelector('[data-iris-copy-button]') as HTMLButtonElement
    fireEvent.click(btn)
    await new Promise((r) => setTimeout(r, 0))
    expect(btn.textContent).toBe('Done!')
  })

  it('calls onCopy with text', async () => {
    const onCopy = vi.fn()
    const { container } = render(() => <IrisCopyButton text="my-text" onCopy={onCopy} />)
    fireEvent.click(container.querySelector('button')!)
    await new Promise((r) => setTimeout(r, 0))
    expect(onCopy).toHaveBeenCalledWith('my-text')
  })

  it('routes the copy through a host clipboard handler, skipping navigator.clipboard', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const handler = vi.fn()
    setClipboardHandler(handler)
    const onCopy = vi.fn()
    const { container } = render(() => <IrisCopyButton text="hello" onCopy={onCopy} />)
    const btn = container.querySelector('[data-iris-copy-button]') as HTMLButtonElement
    fireEvent.click(btn)
    await new Promise((r) => setTimeout(r, 0))
    expect(handler).toHaveBeenCalledWith('hello')
    expect(writeText).not.toHaveBeenCalled()
    expect(onCopy).toHaveBeenCalledWith('hello')
    expect(btn.getAttribute('data-copied')).toBe('true')
  })

  it('still flips copied state and fires onCopy when the host handler throws', async () => {
    setClipboardHandler(() => {
      throw new Error('host clipboard failed')
    })
    const onCopy = vi.fn()
    const { container } = render(() => <IrisCopyButton text="boom" onCopy={onCopy} />)
    const btn = container.querySelector('[data-iris-copy-button]') as HTMLButtonElement
    expect(() => fireEvent.click(btn)).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
    expect(btn.getAttribute('data-copied')).toBe('true')
    expect(onCopy).toHaveBeenCalledWith('boom')
  })

  it('falls through to navigator.clipboard when the handler declines', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    setClipboardHandler(() => false)
    const { container } = render(() => <IrisCopyButton text="x" />)
    fireEvent.click(container.querySelector('[data-iris-copy-button]') as HTMLButtonElement)
    await new Promise((r) => setTimeout(r, 0))
    expect(writeText).toHaveBeenCalledWith('x')
  })
})
