import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisFileUpload from './IrisFileUpload.svelte'

describe('IrisFileUpload', () => {
  it('renders a drop zone', () => {
    const { container } = render(IrisFileUpload)
    expect(container.querySelector('[data-iris-file-upload-zone]')).not.toBeNull()
  })

  it('shows label text', () => {
    const { container } = render(IrisFileUpload, { props: { label: 'Drop here' } })
    expect(container.querySelector('[data-iris-file-upload-label]')!.textContent).toBe('Drop here')
  })

  it('renders hidden file input', () => {
    const { container } = render(IrisFileUpload)
    const input = container.querySelector('[data-iris-file-upload-input]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.type).toBe('file')
  })

  it('marks as disabled', () => {
    const { container } = render(IrisFileUpload, { props: { disabled: true } })
    expect(container.querySelector('[data-disabled="true"]')).not.toBeNull()
  })

  it('shows added files (and removes them) when uncontrolled', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisFileUpload, { props: { multiple: true, onchange } })
    const input = container.querySelector('[data-iris-file-upload-input]') as HTMLInputElement
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await fireEvent.change(input)
    flushSync()
    // Uncontrolled: the list must render the file without a parent writing value back.
    expect(onchange).toHaveBeenCalled()
    const items = container.querySelectorAll('[data-iris-file-upload-item]')
    expect(items.length).toBe(1)
    // Remove it (the per-item remove button)
    const removeBtn = container.querySelector(
      '[data-iris-file-upload-item] button',
    ) as HTMLButtonElement
    await fireEvent.click(removeBtn)
    flushSync()
    expect(container.querySelectorAll('[data-iris-file-upload-item]').length).toBe(0)
  })
})
