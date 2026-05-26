import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisBanner } from './Banner'

describe('IrisBanner', () => {
  it('renders the default slot', () => {
    const w = mount(IrisBanner, { slots: { default: 'New feature available' } })
    expect(w.text()).toContain('New feature available')
  })

  it('reflects data-iris-banner-tone', () => {
    const w = mount(IrisBanner, { props: { tone: 'success' } })
    expect(w.attributes('data-iris-banner-tone')).toBe('success')
  })

  it('renders an icon slot when given', () => {
    const w = mount(IrisBanner, { slots: { icon: '★', default: 'msg' } })
    expect(w.find('[data-iris-banner-icon]').exists()).toBe(true)
    expect(w.find('[data-iris-banner-icon]').text()).toBe('★')
  })

  it('renders an actions slot when given', () => {
    const w = mount(IrisBanner, {
      slots: { default: 'msg', actions: '<button>Action</button>' },
    })
    expect(w.find('[data-iris-banner-actions]').exists()).toBe(true)
  })

  it('sticky=true adds position: sticky and z-index', () => {
    const w = mount(IrisBanner, { props: { sticky: true } })
    const style = w.attributes('style') ?? ''
    expect(style).toContain('position: sticky')
    expect(style).toContain('z-index: 40')
  })

  it('non-sticky does not set position', () => {
    const w = mount(IrisBanner)
    const style = w.attributes('style') ?? ''
    expect(style).not.toContain('position: sticky')
  })

  it('close button is gated behind closable=true', () => {
    expect(mount(IrisBanner).find('[data-iris-banner-close]').exists()).toBe(false)
    expect(
      mount(IrisBanner, { props: { closable: true } })
        .find('[data-iris-banner-close]')
        .exists(),
    ).toBe(true)
  })

  it('clicking close hides the banner (uncontrolled)', async () => {
    const onClose = vi.fn()
    const w = mount(IrisBanner, {
      props: { closable: true },
      slots: { default: 'msg' },
      attrs: { onClose },
    })
    await w.find('[data-iris-banner-close]').trigger('click')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(w.find('[data-iris-banner]').exists()).toBe(false)
  })
})
