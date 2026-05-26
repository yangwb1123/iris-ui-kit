import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisSlider } from './Slider'

describe('IrisSlider', () => {
  it('renders a track + fill + thumb', () => {
    const w = mount(IrisSlider, { props: { modelValue: 30 } })
    expect(w.find('[data-iris-slider-track]').exists()).toBe(true)
    expect(w.find('[data-iris-slider-fill]').exists()).toBe(true)
    expect(w.find('[data-iris-slider-thumb]').exists()).toBe(true)
  })

  it('thumb has role="slider" + aria values', () => {
    const w = mount(IrisSlider, { props: { modelValue: 25, min: 0, max: 100 } })
    const thumb = w.find('[data-iris-slider-thumb]')
    expect(thumb.attributes('role')).toBe('slider')
    expect(thumb.attributes('aria-valuenow')).toBe('25')
    expect(thumb.attributes('aria-valuemin')).toBe('0')
    expect(thumb.attributes('aria-valuemax')).toBe('100')
  })

  it('fill width equals percent', () => {
    const w = mount(IrisSlider, { props: { modelValue: 40, min: 0, max: 100 } })
    expect(w.find('[data-iris-slider-fill]').attributes('style')).toContain('width: 40%')
  })

  it('thumb left equals percent', () => {
    const w = mount(IrisSlider, { props: { modelValue: 60, min: 0, max: 100 } })
    expect(w.find('[data-iris-slider-thumb]').attributes('style')).toContain('left: 60%')
  })

  it('ArrowRight steps up by step', async () => {
    const onUpdate = vi.fn()
    const onChange = vi.fn()
    const w = mount(IrisSlider, {
      props: { modelValue: 10, step: 5 },
      attrs: { 'onUpdate:modelValue': onUpdate, onChange },
    })
    await w.find('[data-iris-slider-thumb]').trigger('keydown', { key: 'ArrowRight' })
    expect(onUpdate).toHaveBeenLastCalledWith(15)
    expect(onChange).toHaveBeenLastCalledWith(15)
  })

  it('ArrowLeft steps down by step', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisSlider, {
      props: { modelValue: 10, step: 5 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-slider-thumb]').trigger('keydown', { key: 'ArrowLeft' })
    expect(onUpdate).toHaveBeenLastCalledWith(5)
  })

  it('Home jumps to min, End jumps to max', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisSlider, {
      props: { modelValue: 50, min: 0, max: 100 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-slider-thumb]').trigger('keydown', { key: 'Home' })
    expect(onUpdate).toHaveBeenLastCalledWith(0)
    await w.find('[data-iris-slider-thumb]').trigger('keydown', { key: 'End' })
    expect(onUpdate).toHaveBeenLastCalledWith(100)
  })

  it('PageUp / PageDown move by 10x step', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisSlider, {
      props: { modelValue: 50, step: 2 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-slider-thumb]').trigger('keydown', { key: 'PageUp' })
    expect(onUpdate).toHaveBeenLastCalledWith(70)
    await w.find('[data-iris-slider-thumb]').trigger('keydown', { key: 'PageDown' })
    expect(onUpdate).toHaveBeenLastCalledWith(30)
  })

  it('clamps to [min, max]', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisSlider, {
      props: { modelValue: 100, min: 0, max: 100, step: 5 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-slider-thumb]').trigger('keydown', { key: 'ArrowRight' })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('disabled blocks keyboard input', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisSlider, {
      props: { modelValue: 50, disabled: true },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-slider-thumb]').trigger('keydown', { key: 'ArrowRight' })
    expect(onUpdate).not.toHaveBeenCalled()
    expect(w.find('[data-iris-slider-thumb]').attributes('aria-disabled')).toBe('true')
  })

  it('orientation="vertical" updates data attr + aria-orientation', () => {
    const w = mount(IrisSlider, { props: { modelValue: 30, orientation: 'vertical' } })
    expect(w.attributes('data-iris-slider-orientation')).toBe('vertical')
    expect(w.find('[data-iris-slider-thumb]').attributes('aria-orientation')).toBe('vertical')
  })

  it('decimal step rounds correctly', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisSlider, {
      props: { modelValue: 0.2, min: 0, max: 1, step: 0.1 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-slider-thumb]').trigger('keydown', { key: 'ArrowRight' })
    expect(onUpdate).toHaveBeenLastCalledWith(0.3)
  })
})
