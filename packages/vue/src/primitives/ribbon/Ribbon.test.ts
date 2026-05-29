import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisRibbon } from './Ribbon'

describe('IrisRibbon', () => {
  it('renders the badge text and slot content', () => {
    const w = mount(IrisRibbon, {
      props: { text: 'New' },
      slots: { default: '<div data-child="">Card</div>' },
    })
    expect(w.find('[data-iris-ribbon-badge]').text()).toBe('New')
    expect(w.find('[data-child]').text()).toBe('Card')
  })

  it('defaults to the end placement', () => {
    const w = mount(IrisRibbon, { props: { text: 'x' } })
    expect(w.find('[data-iris-ribbon]').attributes('data-placement')).toBe('end')
  })

  it('supports the start placement', () => {
    const w = mount(IrisRibbon, { props: { text: 'x', placement: 'start' } })
    expect(w.find('[data-iris-ribbon]').attributes('data-placement')).toBe('start')
  })

  it('applies a custom color', () => {
    const w = mount(IrisRibbon, { props: { text: 'x', color: 'rgb(1, 2, 3)' } })
    expect((w.find('[data-iris-ribbon-badge]').element as HTMLElement).style.background).toBe(
      'rgb(1, 2, 3)',
    )
  })
})
