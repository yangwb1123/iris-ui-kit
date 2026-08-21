import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'

enableAutoUnmount(afterEach)

const columns = [{ key: 'name', title: 'Name' }]
const data = [{ id: 1, name: 'Alice' }]

describe('Vue IrisTable density', () => {
  it('uses comfortable by default and accepts compact/cozy values', async () => {
    const wrapper = mount(IrisTable, { props: { columns, data } })
    expect(wrapper.find('[data-iris-table]').attributes('data-density')).toBe('comfortable')
    await wrapper.setProps({ density: 'compact' })
    expect(wrapper.find('[data-iris-table]').attributes('data-density')).toBe('compact')
    await wrapper.setProps({ density: 'cozy' })
    expect(wrapper.find('[data-iris-table]').attributes('data-density')).toBe('cozy')
  })

  it('densityToggle works without a toolbar and cycles three states', async () => {
    const wrapper = mount(IrisTable, { props: { columns, data, densityToggle: true } })
    const button = wrapper.find('[data-iris-density-toggle]')
    expect(button.exists()).toBe(true)
    expect(wrapper.find('[data-iris-table]').attributes('data-density')).toBe('comfortable')
    await button.trigger('click')
    await nextTick()
    expect(wrapper.find('[data-iris-table]').attributes('data-density')).toBe('compact')
    await button.trigger('click')
    await nextTick()
    expect(wrapper.find('[data-iris-table]').attributes('data-density')).toBe('cozy')
  })

  it('invalid runtime density fails closed', () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data, density: 'invalid' as never },
    })
    expect(wrapper.find('[data-iris-table]').attributes('data-density')).toBe('comfortable')
  })
})
