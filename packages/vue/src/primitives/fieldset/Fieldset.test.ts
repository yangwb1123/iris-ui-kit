import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisFieldset } from './Fieldset'

const fs = (w: ReturnType<typeof mount>) =>
  w.find('[data-iris-fieldset]').element as HTMLFieldSetElement

describe('IrisFieldset', () => {
  it('renders the legend and slot content', () => {
    const w = mount(IrisFieldset, {
      props: { legend: 'Account' },
      slots: { default: '<input data-child />' },
    })
    expect(w.find('[data-iris-fieldset-legend]').text()).toBe('Account')
    expect(w.find('[data-child]').exists()).toBe(true)
  })

  it('disables the group natively', () => {
    const w = mount(IrisFieldset, { props: { legend: 'x', disabled: true } })
    expect(fs(w).disabled).toBe(true)
  })

  it('is enabled by default', () => {
    const w = mount(IrisFieldset, { props: { legend: 'x' } })
    expect(fs(w).disabled).toBe(false)
  })

  it('renders a hint', () => {
    const w = mount(IrisFieldset, { props: { legend: 'x', hint: 'Required fields' } })
    expect(w.find('[data-iris-fieldset-hint]').text()).toBe('Required fields')
  })
})
