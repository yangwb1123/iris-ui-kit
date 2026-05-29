import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisImage } from './Image'

describe('IrisImage', () => {
  it('renders an img with src and alt', () => {
    const w = mount(IrisImage, { props: { src: '/a.png', alt: 'Avatar' } })
    const img = w.find('[data-iris-image]')
    expect(img.attributes('src')).toBe('/a.png')
    expect(img.attributes('alt')).toBe('Avatar')
  })

  it('swaps to the fallback on error', async () => {
    const w = mount(IrisImage, { props: { src: '/a.png', fallback: '/fb.png' } })
    await w.find('[data-iris-image]').trigger('error')
    expect(w.find('[data-iris-image]').attributes('src')).toBe('/fb.png')
    expect(w.find('[data-iris-image]').attributes('data-errored')).toBe('true')
  })

  it('opens a dialog preview overlay on click', async () => {
    const w = mount(IrisImage, { props: { src: '/a.png', alt: 'A' } })
    await w.find('[data-iris-image]').trigger('click')
    expect(w.find('[data-iris-image-preview]').exists()).toBe(true)
    expect(w.find('[data-iris-image-preview]').attributes('role')).toBe('dialog')
  })

  it('preview=false disables click-to-open', async () => {
    const w = mount(IrisImage, { props: { src: '/a.png', preview: false } })
    await w.find('[data-iris-image]').trigger('click')
    expect(w.find('[data-iris-image-preview]').exists()).toBe(false)
  })

  it('closes the preview on backdrop click', async () => {
    const w = mount(IrisImage, { props: { src: '/a.png' } })
    await w.find('[data-iris-image]').trigger('click')
    await w.find('[data-iris-image-preview]').trigger('click')
    expect(w.find('[data-iris-image-preview]').exists()).toBe(false)
  })

  it('does not open a preview after an error', async () => {
    const w = mount(IrisImage, { props: { src: '/a.png', fallback: '/fb.png' } })
    await w.find('[data-iris-image]').trigger('error')
    await w.find('[data-iris-image]').trigger('click')
    expect(w.find('[data-iris-image-preview]').exists()).toBe(false)
  })
})
