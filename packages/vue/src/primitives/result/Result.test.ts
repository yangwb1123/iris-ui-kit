import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisResult } from './Result'

describe('IrisResult', () => {
  it('renders title and subtitle', () => {
    const w = mount(IrisResult, { props: { title: 'Done', subtitle: 'All good' } })
    expect(w.find('[data-iris-result-title]').text()).toBe('Done')
    expect(w.find('[data-iris-result-subtitle]').text()).toBe('All good')
  })

  it('reflects the status and its default glyph', () => {
    const w = mount(IrisResult, { props: { status: 'success', title: 'OK' } })
    expect(w.find('[data-iris-result]').attributes('data-status')).toBe('success')
    expect(w.find('[data-iris-result-icon]').text()).toBe('✓')
  })

  it('defaults to the info status', () => {
    const w = mount(IrisResult, { props: { title: 'Note' } })
    expect(w.find('[data-iris-result]').attributes('data-status')).toBe('info')
  })

  it('allows overriding the icon via the #icon slot', () => {
    const w = mount(IrisResult, {
      props: { title: 'X' },
      slots: { icon: '<span data-custom-icon="">★</span>' },
    })
    expect(w.find('[data-custom-icon]').text()).toBe('★')
  })

  it('renders #extra actions and default content', () => {
    const w = mount(IrisResult, {
      props: { title: 'Error' },
      slots: { extra: '<button>Retry</button>', default: '<code data-details="">stack</code>' },
    })
    expect(w.find('[data-iris-result-extra] button').text()).toBe('Retry')
    expect(w.find('[data-iris-result-content] [data-details]').text()).toBe('stack')
  })

  it('marks the icon decorative', () => {
    const w = mount(IrisResult, { props: { status: 'error', title: 'Oops' } })
    expect(w.find('[data-iris-result-icon]').attributes('aria-hidden')).toBe('true')
  })
})
