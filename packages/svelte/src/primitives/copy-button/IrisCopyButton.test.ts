import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { setClipboardHandler } from '@iris-ui/core'
import IrisCopyButton from './IrisCopyButton.svelte'

afterEach(() => {
  setClipboardHandler(null)
})

describe('IrisCopyButton', () => {
  it('renders a copy button', () => {
    const { container } = render(IrisCopyButton, { props: { text: 'hello' } })
    const btn = container.querySelector('[data-iris-copy-button]')
    expect(btn).toBeTruthy()
    expect(btn!.getAttribute('data-copied')).toBeNull()
  })

  it('shows copied state after click', async () => {
    const { container } = render(IrisCopyButton, { props: { text: 'hello' } })
    const btn = container.querySelector('[data-iris-copy-button]')!
    await fireEvent.click(btn)
    flushSync()
    expect(btn.getAttribute('data-copied')).toBe('true')
    expect(btn.textContent?.trim()).toBe('Copied')
  })

  it('calls oncopy when clicked', async () => {
    const oncopy = vi.fn()
    const { container } = render(IrisCopyButton, { props: { text: 'hello', oncopy } })
    const btn = container.querySelector('[data-iris-copy-button]')!
    await fireEvent.click(btn)
    flushSync()
    expect(oncopy).toHaveBeenCalledWith('hello')
  })

  it('routes the copy through a host clipboard handler, skipping navigator.clipboard', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const handler = vi.fn()
    setClipboardHandler(handler)
    const oncopy = vi.fn()
    const { container } = render(IrisCopyButton, { props: { text: 'hello', oncopy } })
    const btn = container.querySelector('[data-iris-copy-button]')!
    await fireEvent.click(btn)
    flushSync()
    expect(handler).toHaveBeenCalledWith('hello')
    expect(writeText).not.toHaveBeenCalled()
    expect(oncopy).toHaveBeenCalledWith('hello')
    expect(btn.getAttribute('data-copied')).toBe('true')
  })

  it('still flips copied state and fires oncopy when the host handler throws', async () => {
    setClipboardHandler(() => {
      throw new Error('host clipboard exploded')
    })
    const oncopy = vi.fn()
    const { container } = render(IrisCopyButton, { props: { text: 'hello', oncopy } })
    const btn = container.querySelector('[data-iris-copy-button]')!
    await expect(fireEvent.click(btn)).resolves.not.toThrow()
    flushSync()
    expect(oncopy).toHaveBeenCalledWith('hello')
    expect(btn.getAttribute('data-copied')).toBe('true')
  })

  it('falls through to navigator.clipboard when the handler declines', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    setClipboardHandler(() => false)
    const { container } = render(IrisCopyButton, { props: { text: 'x' } })
    const btn = container.querySelector('[data-iris-copy-button]')!
    await fireEvent.click(btn)
    flushSync()
    expect(writeText).toHaveBeenCalledWith('x')
  })
})
