import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisPasswordInput } from './PasswordInput'

describe('IrisPasswordInput', () => {
  it('renders an input of type=password by default', () => {
    const w = mount(IrisPasswordInput)
    expect(w.find('input').attributes('type')).toBe('password')
  })

  it('renders the toggle button by default', () => {
    const w = mount(IrisPasswordInput)
    expect(w.find('[data-iris-password-input-toggle]').exists()).toBe(true)
  })

  it('showToggle=false hides the toggle', () => {
    const w = mount(IrisPasswordInput, { props: { showToggle: false } })
    expect(w.find('[data-iris-password-input-toggle]').exists()).toBe(false)
  })

  it('clicking the toggle flips type to text', async () => {
    const w = mount(IrisPasswordInput)
    await w.find('[data-iris-password-input-toggle]').trigger('click')
    expect(w.find('input').attributes('type')).toBe('text')
    await w.find('[data-iris-password-input-toggle]').trigger('click')
    expect(w.find('input').attributes('type')).toBe('password')
  })

  it('toggle reflects aria-pressed', async () => {
    const w = mount(IrisPasswordInput)
    expect(w.find('[data-iris-password-input-toggle]').attributes('aria-pressed')).toBe('false')
    await w.find('[data-iris-password-input-toggle]').trigger('click')
    expect(w.find('[data-iris-password-input-toggle]').attributes('aria-pressed')).toBe('true')
  })

  it('forwards modelValue + emits update', async () => {
    const onUpdate = vi.fn()
    const w = mount(IrisPasswordInput, {
      props: { modelValue: 'init' },
      attrs: { 'onUpdate:modelValue': onUpdate },
    })
    expect((w.find('input').element as HTMLInputElement).value).toBe('init')
    await w.find('input').setValue('abc')
    expect(onUpdate).toHaveBeenLastCalledWith('abc')
  })

  it('disabled propagates and disables the toggle behavior', async () => {
    const w = mount(IrisPasswordInput, { props: { disabled: true } })
    expect(w.find('input').attributes('disabled')).toBeDefined()
    // Click should still fire but visibility shouldn't flip.
    await w.find('[data-iris-password-input-toggle]').trigger('click')
    expect(w.find('input').attributes('type')).toBe('password')
  })

  it('readonly is forwarded', () => {
    const w = mount(IrisPasswordInput, { props: { readonly: true } })
    expect(w.find('input').attributes('readonly')).toBeDefined()
  })

  it('invalid is forwarded as aria-invalid', () => {
    const w = mount(IrisPasswordInput, { props: { invalid: true } })
    expect(w.find('input').attributes('aria-invalid')).toBe('true')
  })
})
