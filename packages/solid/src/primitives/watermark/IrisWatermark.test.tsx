import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisWatermark } from './IrisWatermark'

afterEach(cleanup)

describe('IrisWatermark', () => {
  it('renders children', () => {
    const { getByText } = render(() => (
      <IrisWatermark content="CONFIDENTIAL">
        <div>Content</div>
      </IrisWatermark>
    ))
    expect(getByText('Content')).toBeTruthy()
  })

  it('renders the overlay with tiles', () => {
    const { container } = render(() => (
      <IrisWatermark content="TEST">
        <div />
      </IrisWatermark>
    ))
    const overlay = container.querySelector('[data-iris-watermark-overlay]')
    expect(overlay).not.toBeNull()
    expect(overlay?.getAttribute('aria-hidden')).toBe('true')
    const tiles = container.querySelectorAll('[data-iris-watermark-tile]')
    expect(tiles.length).toBe(72)
  })

  it('displays the content text in each tile', () => {
    const { container } = render(() => (
      <IrisWatermark content="DRAFT">
        <div />
      </IrisWatermark>
    ))
    const tiles = container.querySelectorAll('[data-iris-watermark-tile]')
    expect(tiles[0].textContent).toBe('DRAFT')
  })

  it('overlay has pointer-events: none', () => {
    const { container } = render(() => (
      <IrisWatermark content="X">
        <div />
      </IrisWatermark>
    ))
    const overlay = container.querySelector('[data-iris-watermark-overlay]') as HTMLElement
    expect(overlay.style.pointerEvents).toBe('none')
  })
})
