import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import IrisWatermark from './IrisWatermark.svelte'

afterEach(cleanup)

describe('@iris-ui-kit/svelte IrisWatermark', () => {
  it('renders the watermark container', () => {
    const { container } = render(IrisWatermark, { props: { content: 'CONFIDENTIAL' } })
    expect(container.querySelector('[data-iris-watermark]')).not.toBeNull()
  })

  it('renders the overlay div with aria-hidden', () => {
    const { container } = render(IrisWatermark, { props: { content: 'DRAFT' } })
    const overlay = container.querySelector('[data-iris-watermark-overlay]')
    expect(overlay).not.toBeNull()
    expect(overlay!.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders 72 tile spans with the watermark content', () => {
    const { container } = render(IrisWatermark, { props: { content: 'INTERNAL' } })
    const tiles = container.querySelectorAll('[data-iris-watermark-tile]')
    expect(tiles).toHaveLength(72)
    expect(tiles[0].textContent?.trim()).toBe('INTERNAL')
  })

  it('overlay has pointer-events: none', () => {
    const { container } = render(IrisWatermark, { props: { content: 'X' } })
    const overlay = container.querySelector<HTMLElement>('[data-iris-watermark-overlay]')!
    expect(overlay.getAttribute('style')).toContain('pointer-events: none')
  })
})
