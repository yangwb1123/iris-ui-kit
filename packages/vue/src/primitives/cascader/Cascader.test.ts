import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisCascader, type IrisCascaderNode } from './Cascader'

const OPTIONS: IrisCascaderNode[] = [
  {
    label: 'Zhejiang',
    value: 'zj',
    children: [{ label: 'Hangzhou', value: 'hz', children: [{ label: 'West Lake', value: 'wl' }] }],
  },
  { label: 'Jiangsu', value: 'js', children: [{ label: 'Nanjing', value: 'nj' }] },
]

const trigger = (w: ReturnType<typeof mount>) => w.find('[data-iris-cascader-trigger]')
const columns = (w: ReturnType<typeof mount>) => w.findAll('[data-iris-cascader-column]')

describe('IrisCascader', () => {
  it('shows the placeholder, closed initially', () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS, placeholder: 'Pick' } })
    expect(w.find('[data-iris-cascader-panel]').exists()).toBe(false)
    expect(w.find('[data-iris-cascader-value]').text()).toBe('Pick')
  })

  it('opens to the root column', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    await trigger(w).trigger('click')
    expect(columns(w).length).toBe(1)
    expect(columns(w)[0].findAll('[data-iris-cascader-option]').length).toBe(2)
  })

  it('clicking a branch reveals the next column', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    await trigger(w).trigger('click')
    await w.find('[data-iris-cascader-option][data-value="zj"]').trigger('click')
    expect(columns(w).length).toBe(2)
    expect(w.find('[data-value="hz"]').exists()).toBe(true)
  })

  it('clicking a leaf commits the path and closes', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    await trigger(w).trigger('click')
    await w.find('[data-value="js"]').trigger('click')
    await w.find('[data-value="nj"]').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['js', 'nj']])
    expect(w.find('[data-iris-cascader-panel]').exists()).toBe(false)
  })

  it('renders the selected path in the trigger', () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS, modelValue: ['zj', 'hz', 'wl'] } })
    expect(w.find('[data-iris-cascader-value]').text()).toBe('Zhejiang / Hangzhou / West Lake')
  })

  it('a11y: trigger haspopup + expanded toggles', async () => {
    const w = mount(IrisCascader, { props: { options: OPTIONS } })
    const t = trigger(w)
    expect(t.attributes('aria-haspopup')).toBe('listbox')
    expect(t.attributes('aria-expanded')).toBe('false')
    await t.trigger('click')
    expect(t.attributes('aria-expanded')).toBe('true')
  })
})
