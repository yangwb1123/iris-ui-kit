import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisDescriptions, type IrisDescriptionsItem } from './Descriptions'

const ITEMS: IrisDescriptionsItem[] = [
  { label: 'Name', value: 'Ada' },
  { label: 'Role', value: 'Engineer' },
]

describe('IrisDescriptions', () => {
  it('renders a <dl> with a dt/dd per item', () => {
    const w = mount(IrisDescriptions, { props: { items: ITEMS } })
    expect(w.find('dl[data-iris-descriptions]').exists()).toBe(true)
    expect(w.findAll('[data-iris-descriptions-label]').length).toBe(2)
    expect(w.findAll('[data-iris-descriptions-value]').length).toBe(2)
  })

  it('renders label and value text', () => {
    const w = mount(IrisDescriptions, { props: { items: ITEMS } })
    expect(w.find('[data-iris-descriptions-label]').text()).toBe('Name')
    expect(w.find('[data-iris-descriptions-value]').text()).toBe('Ada')
  })

  it('horizontal layout puts dt/dd directly in the dl (no wrapper)', () => {
    const w = mount(IrisDescriptions, { props: { items: ITEMS, layout: 'horizontal' } })
    expect(w.find('[data-iris-descriptions]').attributes('data-layout')).toBe('horizontal')
    expect(w.find('[data-iris-descriptions-item]').exists()).toBe(false)
  })

  it('vertical layout wraps each pair in an item', () => {
    const w = mount(IrisDescriptions, { props: { items: ITEMS, layout: 'vertical' } })
    expect(w.findAll('[data-iris-descriptions-item]').length).toBe(2)
  })

  it('columns drive the grid template', () => {
    const w = mount(IrisDescriptions, { props: { items: ITEMS, columns: 2 } })
    const dl = w.find('[data-iris-descriptions]').element as HTMLElement
    expect(dl.style.gridTemplateColumns).toContain('repeat(2')
  })
})
