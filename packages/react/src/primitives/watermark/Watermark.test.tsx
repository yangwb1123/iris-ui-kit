import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisWatermark } from './Watermark'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisWatermark', () => {
  it('renders its children', () => {
    const { container } = render(
      <IrisWatermark content="DRAFT">
        <div data-child="">Body</div>
      </IrisWatermark>,
    )
    expect(container.querySelector('[data-child]')?.textContent).toBe('Body')
  })

  it('renders an aria-hidden, non-interactive overlay of tiles', () => {
    const { container } = render(<IrisWatermark content="DRAFT" />)
    const overlay = container.querySelector('[data-iris-watermark-overlay]') as HTMLElement
    expect(overlay.getAttribute('aria-hidden')).toBe('true')
    expect(overlay.style.pointerEvents).toBe('none')
    const tiles = container.querySelectorAll('[data-iris-watermark-tile]')
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles[0].textContent).toBe('DRAFT')
  })

  it('applies the rotation to tiles', () => {
    const { container } = render(<IrisWatermark content="X" rotate={-45} />)
    const tile = container.querySelector('[data-iris-watermark-tile]') as HTMLElement
    expect(tile.style.transform).toBe('rotate(-45deg)')
  })
})
