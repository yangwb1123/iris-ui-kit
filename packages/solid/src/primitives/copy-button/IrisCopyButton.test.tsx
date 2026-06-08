import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisCopyButton } from './IrisCopyButton'

afterEach(cleanup)

describe('IrisCopyButton', () => {
  it('renders with default label', () => {
    const { getByText } = render(() => <IrisCopyButton text="hello" />)
    expect(getByText('Copy')).toBeTruthy()
  })

  it('renders custom children', () => {
    const { getByText } = render(() => <IrisCopyButton text="hello">Copy Code</IrisCopyButton>)
    expect(getByText('Copy Code')).toBeTruthy()
  })

  it('shows copied state on click', () => {
    const { container } = render(() => <IrisCopyButton text="hello" />)
    const btn = container.querySelector('[data-iris-copy-button]') as HTMLButtonElement
    fireEvent.click(btn)
    expect(btn.getAttribute('data-copied')).toBe('true')
    expect(btn.textContent).toBe('Copied')
  })

  it('uses custom copiedLabel', () => {
    const { container } = render(() => <IrisCopyButton text="hi" copiedLabel="Done!" />)
    const btn = container.querySelector('[data-iris-copy-button]') as HTMLButtonElement
    fireEvent.click(btn)
    expect(btn.textContent).toBe('Done!')
  })

  it('calls onCopy with text', () => {
    const onCopy = vi.fn()
    const { container } = render(() => <IrisCopyButton text="my-text" onCopy={onCopy} />)
    fireEvent.click(container.querySelector('button')!)
    expect(onCopy).toHaveBeenCalledWith('my-text')
  })
})
