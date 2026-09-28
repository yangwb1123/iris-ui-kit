import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisSlider } from './IrisSlider'

afterEach(cleanup)

describe('IrisSlider', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisSlider />)
    expect(container.querySelector('[data-iris-slider]')).not.toBeNull()
  })

  it('renders track, fill, and thumb', () => {
    const { container } = render(() => <IrisSlider value={50} />)
    expect(container.querySelector('[data-iris-slider-track]')).not.toBeNull()
    expect(container.querySelector('[data-iris-slider-fill]')).not.toBeNull()
    expect(container.querySelector('[data-iris-slider-thumb]')).not.toBeNull()
  })

  it('thumb has correct aria attributes', () => {
    const { container } = render(() => <IrisSlider value={30} min={0} max={100} label="Volume" />)
    const thumb = container.querySelector('[data-iris-slider-thumb]') as HTMLElement
    expect(thumb.getAttribute('role')).toBe('slider')
    expect(thumb.getAttribute('aria-valuenow')).toBe('30')
    expect(thumb.getAttribute('aria-valuemin')).toBe('0')
    expect(thumb.getAttribute('aria-valuemax')).toBe('100')
    expect(thumb.getAttribute('aria-label')).toBe('Volume')
  })

  it('responds to ArrowRight key (uncontrolled)', () => {
    const onChange = vi.fn()
    const { container } = render(() => <IrisSlider defaultValue={50} onChange={onChange} />)
    const thumb = container.querySelector('[data-iris-slider-thumb]') as HTMLElement
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(51)
  })

  function mockTrackRect(): HTMLElement {
    const track = document.querySelector('[data-iris-slider-track]') as HTMLElement
    track.getBoundingClientRect = () =>
      ({ left: 0, right: 200, top: 0, bottom: 6, width: 200, height: 6 }) as DOMRect
    return track
  }

  it('maps RTL track endpoints from the right edge', () => {
    const onChange = vi.fn()
    render(() => (
      <div dir="rtl">
        <IrisSlider defaultValue={50} onChange={onChange} />
      </div>
    ))
    const track = mockTrackRect()

    fireEvent.click(track, { clientX: 0 })
    expect(onChange).toHaveBeenLastCalledWith(100)
    fireEvent.click(track, { clientX: 200 })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('keeps LTR track endpoints mapped from the left edge', () => {
    const onChange = vi.fn()
    render(() => (
      <div dir="ltr">
        <IrisSlider defaultValue={50} onChange={onChange} />
      </div>
    ))
    const track = mockTrackRect()

    fireEvent.click(track, { clientX: 0 })
    expect(onChange).toHaveBeenLastCalledWith(0)
    fireEvent.click(track, { clientX: 200 })
    expect(onChange).toHaveBeenLastCalledWith(100)
  })
})
