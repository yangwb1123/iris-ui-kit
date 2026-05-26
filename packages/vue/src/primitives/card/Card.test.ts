import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisCard } from './Card'

describe('IrisCard', () => {
  it('renders the default slot in the body', () => {
    const w = mount(IrisCard, { slots: { default: 'hello' } })
    expect(w.find('[data-iris-card-body]').exists()).toBe(true)
    expect(w.find('[data-iris-card-body]').text()).toBe('hello')
  })

  it('omits the header when not provided', () => {
    const w = mount(IrisCard, { slots: { default: 'body' } })
    expect(w.find('[data-iris-card-header]').exists()).toBe(false)
  })

  it('renders header / body / footer all together', () => {
    const w = mount(IrisCard, {
      slots: {
        header: '<h3>Title</h3>',
        default: '<p>Body</p>',
        footer: '<button>Action</button>',
      },
    })
    expect(w.find('[data-iris-card-header]').exists()).toBe(true)
    expect(w.find('[data-iris-card-body]').exists()).toBe(true)
    expect(w.find('[data-iris-card-footer]').exists()).toBe(true)
  })

  it('elevated variant uses box-shadow', () => {
    const w = mount(IrisCard, { props: { variant: 'elevated' }, slots: { default: 'x' } })
    expect(w.attributes('style')).toContain('box-shadow')
  })

  it('outline variant uses border', () => {
    const w = mount(IrisCard, { props: { variant: 'outline' }, slots: { default: 'x' } })
    expect(w.attributes('style')).toContain('var(--iris-border)')
  })

  it('subtle variant uses surface background', () => {
    const w = mount(IrisCard, { props: { variant: 'subtle' }, slots: { default: 'x' } })
    expect(w.attributes('style')).toContain('var(--iris-surface)')
  })

  it('exposes data attrs for variant / padding / hover', () => {
    const w = mount(IrisCard, {
      props: { variant: 'subtle', padding: 'lg', hover: true },
      slots: { default: 'x' },
    })
    expect(w.attributes('data-iris-card-variant')).toBe('subtle')
    expect(w.attributes('data-iris-card-padding')).toBe('lg')
    expect(w.attributes('data-iris-card-hover')).toBe('true')
  })

  it('padding="none" yields zero section padding', () => {
    const w = mount(IrisCard, { props: { padding: 'none' }, slots: { default: 'x' } })
    expect(w.find('[data-iris-card-body]').attributes('style')).toContain('padding: 0')
  })
})
