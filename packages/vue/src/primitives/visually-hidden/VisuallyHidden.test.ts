import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisVisuallyHidden } from './VisuallyHidden'

describe('IrisVisuallyHidden', () => {
  it('renders its slot content', () => {
    const w = mount(IrisVisuallyHidden, { slots: { default: 'Loading' } })
    expect(w.find('[data-iris-visually-hidden]').text()).toBe('Loading')
  })

  it('applies the visually-hidden clip styles', () => {
    const w = mount(IrisVisuallyHidden, { slots: { default: 'x' } })
    const el = w.find('[data-iris-visually-hidden]').element as HTMLElement
    expect(el.style.position).toBe('absolute')
    expect(el.style.overflow).toBe('hidden')
  })

  it('forwards attributes like aria-live and role', () => {
    const w = mount(IrisVisuallyHidden, {
      attrs: { 'aria-live': 'polite', role: 'status' },
      slots: { default: 'x' },
    })
    expect(w.find('[data-iris-visually-hidden]').attributes('aria-live')).toBe('polite')
    expect(w.find('[data-iris-visually-hidden]').attributes('role')).toBe('status')
  })
})
