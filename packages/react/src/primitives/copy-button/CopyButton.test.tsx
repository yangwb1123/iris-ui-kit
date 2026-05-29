import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisCopyButton } from './CopyButton'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
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
