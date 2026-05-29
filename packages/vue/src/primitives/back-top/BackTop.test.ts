import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { IrisBackTop } from './BackTop'

describe('IrisBackTop', () => {
  it('is hidden until the target scrolls past the threshold', async () => {
    const target = document.createElement('div')
    const w = mount(IrisBackTop, { props: { target: () => target, visibilityHeight: 400 } })
    expect(w.find('[data-iris-back-top]').exists()).toBe(false)
    target.scrollTop = 500
    target.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(w.find('[data-iris-back-top]').exists()).toBe(true)
  })

  it('scrolls the target to top on click', async () => {
    const target = document.createElement('div')
    const scrollTo = vi.fn()
    ;(target as unknown as { scrollTo: unknown }).scrollTo = scrollTo
    target.scrollTop = 500
    const w = mount(IrisBackTop, { props: { target: () => target } })
    await nextTick()
    await w.find('[data-iris-back-top]').trigger('click')
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
  })

  it('renders custom content and an accessible label', async () => {
    const target = document.createElement('div')
    target.scrollTop = 500
    const w = mount(IrisBackTop, { props: { target: () => target }, slots: { default: 'TOP' } })
    await nextTick()
    const btn = w.find('[data-iris-back-top]')
    expect(btn.text()).toBe('TOP')
    expect(btn.attributes('aria-label')).toBe('Back to top')
  })
})
