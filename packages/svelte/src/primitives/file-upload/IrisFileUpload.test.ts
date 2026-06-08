import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
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
})
