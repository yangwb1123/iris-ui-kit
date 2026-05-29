import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisTextarea } from './Textarea'

describe('IrisTextarea', () => {
  it('renders a textarea', () => {
    const w = mount(IrisTextarea)
    expect(w.find('textarea').exists()).toBe(true)
  })

  it('default rows = 3', () => {
    const w = mount(IrisTextarea)
    expect(w.find('textarea').attributes('rows')).toBe('3')
  })

  it('value reflects modelValue', () => {
    const w = mount(IrisTextarea, { props: { modelValue: 'hello' } })
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('hello')
  })

  it('emits update:modelValue on input', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisTextarea, { attrs: { 'onUpdate:modelValue': onUpdate } })
    await w.find('textarea').setValue('typed')
    expect(onUpdate).toHaveBeenCalledWith('typed')
  })

  it('disabled propagates to the textarea', () => {
    const w = mount(IrisTextarea, { props: { disabled: true } })
    expect(w.find('textarea').attributes('disabled')).toBeDefined()
  })

  it('readonly propagates to the textarea', () => {
    const w = mount(IrisTextarea, { props: { readonly: true } })
    expect(w.find('textarea').attributes('readonly')).toBeDefined()
  })

  it('invalid adds aria-invalid + data-state', () => {
    const w = mount(IrisTextarea, { props: { invalid: true } })
    expect(w.find('textarea').attributes('aria-invalid')).toBe('true')
    expect(w.attributes('data-state')).toBe('invalid')
  })

  it('maxLength is forwarded', () => {
    const w = mount(IrisTextarea, { props: { maxLength: 50 } })
    expect(w.find('textarea').attributes('maxlength')).toBe('50')
  })

  it('focus/blur change data-state', async () => {
    const w = mount(IrisTextarea)
    expect(w.attributes('data-state')).toBe('idle')
    await w.find('textarea').trigger('focus')
    expect(w.attributes('data-state')).toBe('focused')
    await w.find('textarea').trigger('blur')
    expect(w.attributes('data-state')).toBe('idle')
  })

  it('size sm/md/lg flips data attr and font sizing', () => {
    expect(
      mount(IrisTextarea, { props: { size: 'sm' } }).attributes('data-iris-textarea-size'),
    ).toBe('sm')
    expect(mount(IrisTextarea, { props: { size: 'lg' } }).attributes('style')).toContain(
      'font-size: 16px',
    )
  })
})
