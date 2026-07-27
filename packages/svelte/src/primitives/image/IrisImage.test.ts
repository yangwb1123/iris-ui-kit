import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import IrisImage from './IrisImage.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisImage', () => {
  it('renders an img element with data-iris-image', () => {
    const { container } = render(IrisImage, { props: { src: '/test.jpg', alt: 'Test' } })
    const img = container.querySelector('img[data-iris-image]')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toBe('/test.jpg')
    expect(img!.getAttribute('alt')).toBe('Test')
  })

  it('has lazy loading by default', () => {
    const { container } = render(IrisImage, { props: { src: '/test.jpg' } })
    expect(container.querySelector('img')!.getAttribute('loading')).toBe('lazy')
  })

  it('opens preview dialog on click when preview=true', async () => {
    const { container } = render(IrisImage, { props: { src: '/test.jpg', preview: true } })
    await fireEvent.click(container.querySelector('img')!)
    flushSync()
    expect(container.querySelector('[data-iris-image-preview]')).not.toBeNull()
  })

  it('does not open preview when preview=false', async () => {
    const { container } = render(IrisImage, { props: { src: '/test.jpg', preview: false } })
    await fireEvent.click(container.querySelector('img')!)
    flushSync()
    expect(container.querySelector('[data-iris-image-preview]')).toBeNull()
  })
})
