import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisOtpInput } from './OtpInput'

describe('IrisOtpInput', () => {
  it('renders `length` cells (default 6)', () => {
    const w = mount(IrisOtpInput)
    expect(w.findAll('[data-iris-otp-input-cell]').length).toBe(6)
  })

  it('honors a custom length', () => {
    const w = mount(IrisOtpInput, { props: { length: 4 } })
    expect(w.findAll('input').length).toBe(4)
  })

  it('typing a digit emits the value', async () => {
    const w = mount(IrisOtpInput, { props: { length: 4 } })
    await w.findAll('input')[0].setValue('1')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['1'])
  })

  it('numeric type rejects letters', async () => {
    const w = mount(IrisOtpInput, { props: { length: 4 } })
    await w.find('input').setValue('a')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('alphanumeric type accepts letters', async () => {
    const w = mount(IrisOtpInput, { props: { length: 4, type: 'alphanumeric' } })
    await w.find('input').setValue('a')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['a'])
  })

  it('fires complete when the final cell fills', async () => {
    const w = mount(IrisOtpInput, { props: { length: 3, modelValue: '12' } })
    await w.findAll('input')[2].setValue('3')
    expect(w.emitted('complete')?.[0]).toEqual(['123'])
  })

  it('Backspace clears the current cell and emits', async () => {
    const w = mount(IrisOtpInput, { props: { length: 4, modelValue: '12' } })
    await w.findAll('input')[1].trigger('keydown', { key: 'Backspace' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['1'])
  })

  it('Backspace on an empty cell removes the previous char', async () => {
    const w = mount(IrisOtpInput, { props: { length: 4, modelValue: '12' } })
    await w.findAll('input')[2].trigger('keydown', { key: 'Backspace' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['1'])
  })

  it('paste distributes and sanitizes, capped at length', async () => {
    const w = mount(IrisOtpInput, { props: { length: 4 } })
    await w.find('input').trigger('paste', { clipboardData: { getData: () => '1a2b3c4d5e' } })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['1234'])
  })

  it('mask renders password cells', () => {
    const w = mount(IrisOtpInput, { props: { mask: true } })
    expect(w.find('input').attributes('type')).toBe('password')
  })

  it('a11y: role=group, per-cell aria-label, id on first cell, aria-invalid', () => {
    const w = mount(IrisOtpInput, { props: { length: 3, id: 'code', invalid: true } })
    expect(w.find('[role="group"]').exists()).toBe(true)
    const inputs = w.findAll('input')
    expect(inputs[0].attributes('aria-label')).toBe('Character 1 of 3')
    expect(inputs[0].attributes('id')).toBe('code')
    expect(inputs[0].attributes('aria-invalid')).toBe('true')
  })
})
