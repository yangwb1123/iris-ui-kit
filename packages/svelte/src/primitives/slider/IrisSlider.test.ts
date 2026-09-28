import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisSlider from './IrisSlider.svelte'

describe('IrisSlider', () => {
  it('renders a thumb with role=slider', () => {
    const { container } = render(IrisSlider, { props: { value: 50 } })
    expect(container.querySelector('[role="slider"]')).not.toBeNull()
  })

  it('sets aria-valuenow', () => {
    const { container } = render(IrisSlider, { props: { value: 30, min: 0, max: 100 } })
    const thumb = container.querySelector('[role="slider"]')!
    expect(thumb.getAttribute('aria-valuenow')).toBe('30')
  })

  it('moves value with arrow key', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisSlider, { props: { value: 50, step: 1, onchange } })
    const thumb = container.querySelector('[role="slider"]') as HTMLElement
    await fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    flushSync()
    expect(onchange).toHaveBeenCalledWith(51)
  })

  it('renders track and fill', () => {
    const { container } = render(IrisSlider)
    expect(container.querySelector('[data-iris-slider-track]')).not.toBeNull()
    expect(container.querySelector('[data-iris-slider-fill]')).not.toBeNull()
  })

  function mockTrackRect(container: HTMLElement): HTMLElement {
    const track = container.querySelector('[data-iris-slider-track]') as HTMLElement
    track.getBoundingClientRect = () =>
      ({ left: 0, right: 200, top: 0, bottom: 6, width: 200, height: 6 }) as DOMRect
    return track
  }

  function pointerDownAt(track: HTMLElement, clientX: number): void {
    const event = new Event('pointerdown', { bubbles: true, cancelable: true })
    Object.assign(event, { clientX, clientY: 0, pointerId: 1 })
    track.dispatchEvent(event)
  }

  it('maps RTL track endpoints from the right edge', () => {
    const onchange = vi.fn()
    const { container } = render(IrisSlider, {
      props: { value: 50, dir: 'rtl', onchange },
    })
    const track = mockTrackRect(container)

    pointerDownAt(track, 0)
    flushSync()
    expect(onchange).toHaveBeenLastCalledWith(100)
    pointerDownAt(track, 200)
    flushSync()
    expect(onchange).toHaveBeenLastCalledWith(0)
  })

  it('keeps LTR track endpoints mapped from the left edge', () => {
    const onchange = vi.fn()
    const { container } = render(IrisSlider, {
      props: { value: 50, dir: 'ltr', onchange },
    })
    const track = mockTrackRect(container)

    pointerDownAt(track, 0)
    flushSync()
    expect(onchange).toHaveBeenLastCalledWith(0)
    pointerDownAt(track, 200)
    flushSync()
    expect(onchange).toHaveBeenLastCalledWith(100)
  })
})
