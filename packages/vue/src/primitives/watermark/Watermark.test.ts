import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisWatermark } from './Watermark'

describe('IrisWatermark', () => {
  it('renders its slot content', () => {
    const w = mount(IrisWatermark, {
      props: { content: 'DRAFT' },
      slots: { default: '<div data-child="">Body</div>' },
    })
    expect(w.find('[data-child]').text()).toBe('Body')
  })

  it('renders an aria-hidden, non-interactive overlay of tiles', () => {
    const w = mount(IrisWatermark, { props: { content: 'DRAFT' } })
    const overlay = w.find('[data-iris-watermark-overlay]')
    expect(overlay.attributes('aria-hidden')).toBe('true')
    expect((overlay.element as HTMLElement).style.pointerEvents).toBe('none')
    const tiles = w.findAll('[data-iris-watermark-tile]')
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles[0].text()).toBe('DRAFT')
  })

  it('applies the rotation to tiles', () => {
    const w = mount(IrisWatermark, { props: { content: 'X', rotate: -45 } })
    const tile = w.find('[data-iris-watermark-tile]').element as HTMLElement
    expect(tile.style.transform).toBe('rotate(-45deg)')
  })
})
