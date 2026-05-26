import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisRangeSlider } from './RangeSlider'

afterEach(() => {})

describe('@iris-ui/vue IrisRangeSlider', () => {
  it('renders track + range + two thumbs', () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [20, 80] },
    })
    expect(wrap.find('[data-iris-range-slider-track]').exists()).toBe(true)
    expect(wrap.find('[data-iris-range-slider-range]').exists()).toBe(true)
    expect(wrap.findAll('[data-iris-range-slider-thumb]').length).toBe(2)
  })

  it('thumbs have role="slider" + aria-value attrs', () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [20, 80], min: 0, max: 100 },
    })
    const [start, end] = wrap.findAll('[role=slider]')
    expect(start!.attributes('aria-valuenow')).toBe('20')
    expect(start!.attributes('aria-valuemin')).toBe('0')
    expect(start!.attributes('aria-valuemax')).toBe('80')
    expect(end!.attributes('aria-valuenow')).toBe('80')
    expect(end!.attributes('aria-valuemin')).toBe('20')
    expect(end!.attributes('aria-valuemax')).toBe('100')
  })

  it('range bar position derives from values', () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [20, 80], min: 0, max: 100 },
    })
    const range = wrap.find('[data-iris-range-slider-range]')
    const style = range.attributes('style') || ''
    expect(style).toMatch(/left:\s*20%/)
    expect(style).toMatch(/width:\s*60%/)
  })

  it('ArrowRight on start thumb emits +step', async () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [20, 80], step: 5 },
    })
    const [start] = wrap.findAll('[role=slider]')
    await start!.trigger('keydown', { key: 'ArrowRight' })
    const emit = wrap.emitted('update:modelValue')!
    expect(emit[0]![0]).toEqual([25, 80])
  })

  it('ArrowLeft on end thumb emits -step', async () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [20, 80], step: 5 },
    })
    const [, end] = wrap.findAll('[role=slider]')
    await end!.trigger('keydown', { key: 'ArrowLeft' })
    const emit = wrap.emitted('update:modelValue')!
    expect(emit[0]![0]).toEqual([20, 75])
  })

  it('start handle clamps against end (cannot exceed it)', async () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [75, 80], step: 5 },
    })
    const [start] = wrap.findAll('[role=slider]')
    // ArrowRight from 75 lands at 80; clamped to end=80.
    await start!.trigger('keydown', { key: 'ArrowRight' })
    expect(wrap.emitted('update:modelValue')![0]![0]).toEqual([80, 80])
  })

  it('end handle clamps against start (cannot go below it)', async () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [20, 25], step: 5 },
    })
    const [, end] = wrap.findAll('[role=slider]')
    // ArrowLeft from 25 lands at 20; clamped to start=20.
    await end!.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrap.emitted('update:modelValue')![0]![0]).toEqual([20, 20])
  })

  it('Home on start thumb goes to min', async () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [30, 80], min: 0 },
    })
    const [start] = wrap.findAll('[role=slider]')
    await start!.trigger('keydown', { key: 'Home' })
    const emit = wrap.emitted('update:modelValue')!
    expect(emit[0]![0]).toEqual([0, 80])
  })

  it('End on end thumb goes to max', async () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [20, 70], max: 100 },
    })
    const [, end] = wrap.findAll('[role=slider]')
    await end!.trigger('keydown', { key: 'End' })
    const emit = wrap.emitted('update:modelValue')!
    expect(emit[0]![0]).toEqual([20, 100])
  })

  it('PageUp jumps +step×10', async () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [20, 70], step: 2 },
    })
    const [start] = wrap.findAll('[role=slider]')
    await start!.trigger('keydown', { key: 'PageUp' })
    const emit = wrap.emitted('update:modelValue')!
    expect(emit[0]![0]).toEqual([40, 70])
  })

  it('disabled prevents key emit', async () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [20, 80], disabled: true },
    })
    const [start] = wrap.findAll('[role=slider]')
    await start!.trigger('keydown', { key: 'ArrowRight' })
    expect(wrap.emitted('update:modelValue')).toBeUndefined()
  })

  it('emits change event alongside update:modelValue', async () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [20, 80], step: 5 },
    })
    const [start] = wrap.findAll('[role=slider]')
    await start!.trigger('keydown', { key: 'ArrowRight' })
    expect(wrap.emitted('change')).toBeTruthy()
  })

  it('respects step decimals (e.g. 0.1)', async () => {
    const wrap = mount(IrisRangeSlider, {
      props: { modelValue: [0.2, 0.8], step: 0.1, min: 0, max: 1 },
    })
    const [start] = wrap.findAll('[role=slider]')
    await start!.trigger('keydown', { key: 'ArrowRight' })
    const emit = wrap.emitted('update:modelValue')!
    expect((emit[0]![0] as number[])[0]).toBeCloseTo(0.3, 5)
  })
})
