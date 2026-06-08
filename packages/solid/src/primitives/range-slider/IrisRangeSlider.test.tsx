import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisRangeSlider } from './IrisRangeSlider'

afterEach(cleanup)

describe('IrisRangeSlider', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisRangeSlider />)
    expect(container.querySelector('[data-iris-range-slider]')).not.toBeNull()
  })

  it('renders two thumbs', () => {
    const { container } = render(() => <IrisRangeSlider />)
    const thumbs = container.querySelectorAll('[data-iris-range-slider-thumb]')
    expect(thumbs.length).toBe(2)
  })

  it('thumbs have correct aria attributes', () => {
    const { container } = render(() => <IrisRangeSlider value={[20, 80]} min={0} max={100} />)
    const thumbs = container.querySelectorAll('[role="slider"]')
    expect(thumbs[0].getAttribute('aria-valuenow')).toBe('20')
    expect(thumbs[1].getAttribute('aria-valuenow')).toBe('80')
  })

  it('responds to ArrowRight on start thumb', () => {
    const onChange = vi.fn()
    const { container } = render(() => (
      <IrisRangeSlider defaultValue={[20, 80]} onChange={onChange} />
    ))
    const startThumb = container.querySelector(
      '[data-iris-range-slider-thumb="start"]',
    ) as HTMLElement
    fireEvent.keyDown(startThumb, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith([21, 80])
  })
})
