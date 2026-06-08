import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisCopyButton from './IrisCopyButton.svelte'

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
})
