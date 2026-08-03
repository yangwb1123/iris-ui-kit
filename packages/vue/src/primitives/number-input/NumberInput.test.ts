import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisNumberInput } from './NumberInput'

describe('IrisNumberInput', () => {
  it('syncs its displayed text when a controlled value arrives asynchronously', async () => {
    const w = mount(IrisNumberInput, { props: { modelValue: null } })
    const input = w.find('input')
    expect((input.element as HTMLInputElement).value).toBe('')
    await w.setProps({ modelValue: 1200 })
    expect((input.element as HTMLInputElement).value).toBe('1200')
    await w.setProps({ modelValue: null })
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('renders input + +/- buttons', () => {
    const w = mount(IrisNumberInput)
    expect(w.find('input').exists()).toBe(true)
    expect(w.find('[data-iris-number-input-inc]').exists()).toBe(true)
    expect(w.find('[data-iris-number-input-dec]').exists()).toBe(true)
  })

  it('showControls=false hides the +/- buttons', () => {
    const w = mount(IrisNumberInput, { props: { showControls: false } })
    expect(w.find('[data-iris-number-input-inc]').exists()).toBe(false)
    expect(w.find('[data-iris-number-input-dec]').exists()).toBe(false)
  })

  it('increment by clicking + emits the new value', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisNumberInput, {
      props: { modelValue: 5, step: 1 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-number-input-inc]').trigger('click')
    expect(onUpdate).toHaveBeenLastCalledWith(6)
  })

  it('decrement by clicking − emits the new value', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisNumberInput, {
      props: { modelValue: 5, step: 1 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-number-input-dec]').trigger('click')
    expect(onUpdate).toHaveBeenLastCalledWith(4)
  })

  it('ArrowUp / ArrowDown increment / decrement', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisNumberInput, {
      props: { modelValue: 10 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('input').trigger('keydown', { key: 'ArrowUp' })
    expect(onUpdate).toHaveBeenLastCalledWith(11)
    await w.find('input').trigger('keydown', { key: 'ArrowDown' })
    expect(onUpdate).toHaveBeenLastCalledWith(9)
  })

  it('decimal step rounds away floating-point noise (0.1 + 0.2)', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisNumberInput, {
      props: { modelValue: 0.2, step: 0.1 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-number-input-inc]').trigger('click')
    expect(onUpdate).toHaveBeenLastCalledWith(0.3)
  })

  it('empty input emits null', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisNumberInput, {
      props: { modelValue: 5 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('input').setValue('')
    expect(onUpdate).toHaveBeenLastCalledWith(null)
  })

  it('non-numeric input emits null', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisNumberInput, {
      props: { modelValue: 5 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('input').setValue('abc')
    expect(onUpdate).toHaveBeenLastCalledWith(null)
  })

  it('starts from min (or 0) when value is null and user clicks +', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisNumberInput, {
      props: { modelValue: null, min: 3, step: 1 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('[data-iris-number-input-inc]').trigger('click')
    expect(onUpdate).toHaveBeenLastCalledWith(4)
  })

  it('disables +/- when at min/max', () => {
    const wMin = mount(IrisNumberInput, { props: { modelValue: 0, min: 0 } })
    expect(wMin.find('[data-iris-number-input-dec]').attributes('disabled')).toBeDefined()
    const wMax = mount(IrisNumberInput, { props: { modelValue: 100, max: 100 } })
    expect(wMax.find('[data-iris-number-input-inc]').attributes('disabled')).toBeDefined()
  })

  it('emits update on blur with normalized (clamped+rounded) value', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisNumberInput, {
      props: { modelValue: 150, max: 100 },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    await w.find('input').trigger('blur')
    expect(onUpdate).toHaveBeenLastCalledWith(100)
  })

  it('has role="spinbutton" + aria-valuemin/max/now', () => {
    const w = mount(IrisNumberInput, { props: { modelValue: 7, min: 0, max: 10 } })
    const input = w.find('input')
    expect(input.attributes('role')).toBe('spinbutton')
    expect(input.attributes('aria-valuenow')).toBe('7')
    expect(input.attributes('aria-valuemin')).toBe('0')
    expect(input.attributes('aria-valuemax')).toBe('10')
  })
})
