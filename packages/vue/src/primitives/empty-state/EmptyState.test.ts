import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisEmptyState } from './EmptyState'

describe('IrisEmptyState', () => {
  it('renders with role="status"', () => {
    const w = mount(IrisEmptyState, { props: { title: 'None' } })
    expect(w.attributes('role')).toBe('status')
  })

  it('renders title + description from props', () => {
    const w = mount(IrisEmptyState, { props: { title: 'No data', description: 'Try again' } })
    expect(w.find('[data-iris-empty-state-title]').text()).toBe('No data')
    expect(w.find('[data-iris-empty-state-description]').text()).toBe('Try again')
  })

  it('slots win over props', () => {
    const w = mount(IrisEmptyState, {
      props: { title: 'p-title', description: 'p-desc' },
      slots: { title: 's-title', description: 's-desc' },
    })
    expect(w.find('[data-iris-empty-state-title]').text()).toBe('s-title')
    expect(w.find('[data-iris-empty-state-description]').text()).toBe('s-desc')
  })

  it('renders icon + action slots when given', () => {
    const w = mount(IrisEmptyState, {
      props: { title: 'x' },
      slots: { icon: '∅', action: '<button>New</button>' },
    })
    expect(w.find('[data-iris-empty-state-icon]').text()).toBe('∅')
    expect(w.find('[data-iris-empty-state-action]').exists()).toBe(true)
  })

  it('omits the title element when no title is given', () => {
    const w = mount(IrisEmptyState)
    expect(w.find('[data-iris-empty-state-title]').exists()).toBe(false)
  })

  it('omits the description element when none is given', () => {
    const w = mount(IrisEmptyState, { props: { title: 'only' } })
    expect(w.find('[data-iris-empty-state-description]').exists()).toBe(false)
  })
})
