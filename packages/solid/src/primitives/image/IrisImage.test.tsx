import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisImage } from './IrisImage'

afterEach(cleanup)

describe('IrisImage', () => {
  it('renders an img element with the given src and alt', () => {
    const { container } = render(() => <IrisImage src="/img.png" alt="Test image" />)
    const img = container.querySelector('img[data-iris-image]') as HTMLImageElement
    expect(img).not.toBeNull()
    expect(img.getAttribute('alt')).toBe('Test image')
  })

  it('uses lazy loading by default', () => {
    const { container } = render(() => <IrisImage src="/img.png" alt="" />)
    const img = container.querySelector('img[data-iris-image]') as HTMLImageElement
    expect(img.getAttribute('loading')).toBe('lazy')
  })

  it('shows preview dialog when clicked (preview enabled by default)', () => {
    const { container } = render(() => <IrisImage src="/img.png" alt="Preview test" />)
    const img = container.querySelector('img[data-iris-image]') as HTMLImageElement
    fireEvent.click(img)
    expect(container.querySelector('[data-iris-image-preview]')).not.toBeNull()
  })

  it('does not open preview when preview=false', () => {
    const { container } = render(() => <IrisImage src="/img.png" alt="" preview={false} />)
    const img = container.querySelector('img[data-iris-image]') as HTMLImageElement
    fireEvent.click(img)
    expect(container.querySelector('[data-iris-image-preview]')).toBeNull()
  })

  it('closes preview when close button is clicked', () => {
    const { container } = render(() => <IrisImage src="/img.png" alt="" />)
    const img = container.querySelector('img[data-iris-image]') as HTMLImageElement
    fireEvent.click(img)
    const closeBtn = container.querySelector('[data-iris-image-preview-close]') as HTMLElement
    fireEvent.click(closeBtn)
    expect(container.querySelector('[data-iris-image-preview]')).toBeNull()
  })

  it('shows fallback on error', () => {
    const { container } = render(() => (
      <IrisImage src="/broken.png" fallback="/fallback.png" alt="" />
    ))
    const img = container.querySelector('img[data-iris-image]') as HTMLImageElement
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe('/fallback.png')
    expect(img.getAttribute('data-errored')).toBe('true')
  })
})
