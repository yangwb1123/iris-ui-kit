import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisImage } from './Image'

afterEach(() => cleanup())

const img = (c: HTMLElement) => c.querySelector('[data-iris-image]') as HTMLElement
const preview = (c: HTMLElement) => c.querySelector('[data-iris-image-preview]')

describe('@iris-ui/react IrisImage', () => {
  it('renders an img with src and alt', () => {
    const { container } = render(<IrisImage src="/a.png" alt="Avatar" />)
    expect(img(container).getAttribute('src')).toBe('/a.png')
    expect(img(container).getAttribute('alt')).toBe('Avatar')
  })

  it('swaps to the fallback on error', () => {
    const { container } = render(<IrisImage src="/a.png" fallback="/fb.png" />)
    fireEvent.error(img(container))
    expect(img(container).getAttribute('src')).toBe('/fb.png')
    expect(img(container).getAttribute('data-errored')).toBe('true')
  })

  it('opens a dialog preview overlay on click', () => {
    const { container } = render(<IrisImage src="/a.png" alt="A" />)
    fireEvent.click(img(container))
    expect(preview(container)).not.toBeNull()
    expect(preview(container)?.getAttribute('role')).toBe('dialog')
  })

  it('preview=false disables click-to-open', () => {
    const { container } = render(<IrisImage src="/a.png" preview={false} />)
    fireEvent.click(img(container))
    expect(preview(container)).toBeNull()
  })

  it('closes the preview on backdrop click', () => {
    const { container } = render(<IrisImage src="/a.png" />)
    fireEvent.click(img(container))
    fireEvent.click(preview(container)!)
    expect(preview(container)).toBeNull()
  })

  it('does not open a preview after an error', () => {
    const { container } = render(<IrisImage src="/a.png" fallback="/fb.png" />)
    fireEvent.error(img(container))
    fireEvent.click(img(container))
    expect(preview(container)).toBeNull()
  })
})
