import { render, fireEvent } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { describe, it, expect, vi } from 'vitest'
import IrisRangeSlider from './IrisRangeSlider.svelte'

describe('IrisRangeSlider', () => {
  it('renders two thumb sliders', () => {
    const { container } = render(IrisRangeSlider, { props: { value: [20, 80] } })
    const thumbs = container.querySelectorAll('[role="slider"]')
    expect(thumbs.length).toBe(2)
  })

  it('shows start and end values in aria', () => {
    const { container } = render(IrisRangeSlider, { props: { value: [25, 75] } })
    const thumbs = container.querySelectorAll('[role="slider"]')
    expect(thumbs[0].getAttribute('aria-valuenow')).toBe('25')
    expect(thumbs[1].getAttribute('aria-valuenow')).toBe('75')
  })

  it('moves start value with arrow key', async () => {
    const onchange = vi.fn()
    const { container } = render(IrisRangeSlider, {
      props: { value: [20, 80], step: 1, onchange },
    })
    const startThumb = container.querySelector(
      '[data-iris-range-slider-thumb="start"]',
    ) as HTMLElement
    await fireEvent.keyDown(startThumb, { key: 'ArrowRight' })
    flushSync()
    expect(onchange).toHaveBeenCalledWith([21, 80])
  })
})
