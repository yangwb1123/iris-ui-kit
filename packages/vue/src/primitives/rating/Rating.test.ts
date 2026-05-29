import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisRating } from './Rating'

describe('IrisRating', () => {
  it('renders `max` stars (default 5)', () => {
    const w = mount(IrisRating)
    expect(w.findAll('[data-iris-rating-star]').length).toBe(5)
  })

  it('honors a custom max', () => {
    const w = mount(IrisRating, { props: { max: 10 } })
    expect(w.findAll('[data-iris-rating-star]').length).toBe(10)
  })

  it('clicking a star emits the value', async () => {
    const w = mount(IrisRating)
    await w.findAll('[data-iris-rating-star]')[2].trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([3])
  })

  it('clicking the current value clears it (clearable)', async () => {
    const w = mount(IrisRating, { props: { modelValue: 3 } })
    await w.findAll('[data-iris-rating-star]')[2].trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([0])
  })

  it('clearable=false keeps the value when re-clicked', async () => {
    const w = mount(IrisRating, { props: { modelValue: 3, clearable: false } })
    await w.findAll('[data-iris-rating-star]')[2].trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('readonly ignores clicks and is not focusable', async () => {
    const w = mount(IrisRating, { props: { modelValue: 2, readonly: true } })
    await w.findAll('[data-iris-rating-star]')[4].trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.find('[data-iris-rating]').attributes('tabindex')).toBe('-1')
    expect(w.find('[data-iris-rating]').attributes('aria-readonly')).toBe('true')
  })

  it('disabled ignores clicks', async () => {
    const w = mount(IrisRating, { props: { modelValue: 2, disabled: true } })
    await w.findAll('[data-iris-rating-star]')[4].trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.find('[data-iris-rating]').attributes('aria-disabled')).toBe('true')
  })

  it('keyboard: ArrowRight / ArrowLeft step the value', async () => {
    const w = mount(IrisRating, { props: { modelValue: 2 } })
    const el = w.find('[data-iris-rating]')
    await el.trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([3])
    await el.trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([1])
  })

  it('keyboard: Home → 0, End → max', async () => {
    const w = mount(IrisRating, { props: { modelValue: 3, max: 5 } })
    const el = w.find('[data-iris-rating]')
    await el.trigger('keydown', { key: 'Home' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([0])
    await el.trigger('keydown', { key: 'End' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([5])
  })

  it('allowHalf steps by 0.5', async () => {
    const w = mount(IrisRating, { props: { modelValue: 2, allowHalf: true } })
    await w.find('[data-iris-rating]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.[0]).toEqual([2.5])
  })

  it('marks filled and half stars', () => {
    const w = mount(IrisRating, { props: { modelValue: 2.5, allowHalf: true } })
    const s = w.findAll('[data-iris-rating-star]')
    expect(s[0].attributes('data-filled')).toBe('true')
    expect(s[1].attributes('data-filled')).toBe('true')
    expect(s[2].attributes('data-filled')).toBe('half')
    expect(s[3].attributes('data-filled')).toBeUndefined()
  })

  it('a11y: slider role, value attrs, valuetext, id, aria-invalid', () => {
    const w = mount(IrisRating, { props: { modelValue: 2, max: 5, id: 'rate', invalid: true } })
    const el = w.find('[data-iris-rating]')
    expect(el.attributes('role')).toBe('slider')
    expect(el.attributes('aria-valuemin')).toBe('0')
    expect(el.attributes('aria-valuemax')).toBe('5')
    expect(el.attributes('aria-valuenow')).toBe('2')
    expect(el.attributes('aria-valuetext')).toBe('2 of 5')
    expect(el.attributes('id')).toBe('rate')
    expect(el.attributes('aria-invalid')).toBe('true')
  })
})
