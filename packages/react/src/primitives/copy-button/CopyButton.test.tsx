import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { setClipboardHandler } from '@iris-ui/core'
import { IrisCopyButton } from './CopyButton'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  setClipboardHandler(null)
})

const btn = (c: HTMLElement) => c.querySelector('[data-iris-copy-button]') as HTMLElement

describe('@iris-ui/react IrisCopyButton', () => {
  it('renders the default copy label', () => {
    const { container } = render(<IrisCopyButton text="hi" />)
    expect(btn(container).textContent).toBe('Copy')
  })

  it('copies the text and shows the copied state', () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const onCopy = vi.fn()
    const { container } = render(<IrisCopyButton text="hello" onCopy={onCopy} />)
    fireEvent.click(btn(container))
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(onCopy).toHaveBeenCalledWith('hello')
    expect(btn(container).getAttribute('data-copied')).toBe('true')
    expect(btn(container).textContent).toBe('Copied')
  })

  it('routes the copy through a host clipboard handler, skipping navigator.clipboard', () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const handler = vi.fn()
    setClipboardHandler(handler)
    const onCopy = vi.fn()
    const { container } = render(<IrisCopyButton text="hello" onCopy={onCopy} />)
    fireEvent.click(btn(container))
    expect(handler).toHaveBeenCalledWith('hello')
    expect(writeText).not.toHaveBeenCalled()
    expect(onCopy).toHaveBeenCalledWith('hello')
    expect(btn(container).getAttribute('data-copied')).toBe('true')
  })

  it('still surfaces the copied state + onCopy when the host handler throws', () => {
    setClipboardHandler(() => {
      throw new Error('native clipboard failed')
    })
    const onCopy = vi.fn()
    const { container } = render(<IrisCopyButton text="hello" onCopy={onCopy} />)
    expect(() => fireEvent.click(btn(container))).not.toThrow()
    expect(onCopy).toHaveBeenCalledWith('hello')
    expect(btn(container).getAttribute('data-copied')).toBe('true')
  })

  it('falls through to navigator.clipboard when the handler declines', () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    setClipboardHandler(() => false)
    const { container } = render(<IrisCopyButton text="x" />)
    fireEvent.click(btn(container))
    expect(writeText).toHaveBeenCalledWith('x')
  })

  it('reverts after the timeout', () => {
    vi.useFakeTimers()
    const { container } = render(<IrisCopyButton text="x" timeout={1000} />)
    fireEvent.click(btn(container))
    expect(btn(container).getAttribute('data-copied')).toBe('true')
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(btn(container).getAttribute('data-copied')).toBeNull()
  })

  it('disabled does nothing', () => {
    const onCopy = vi.fn()
    const { container } = render(<IrisCopyButton text="x" disabled onCopy={onCopy} />)
    fireEvent.click(btn(container))
    expect(onCopy).not.toHaveBeenCalled()
  })

  it('renders custom children', () => {
    const { container } = render(<IrisCopyButton text="x">Copy URL</IrisCopyButton>)
    expect(btn(container).textContent).toBe('Copy URL')
  })
})
