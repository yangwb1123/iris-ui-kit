import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createNotificationCenter } from '../core'
import { IrisNotificationCenter } from './index'

describe('IrisNotificationCenter (vue)', () => {
  it('renders items + unread badge, marks read on click, dismisses', async () => {
    const center = createNotificationCenter()
    center.push({ title: 'First' })
    center.push({ title: 'Second' })
    const wrapper = mount(IrisNotificationCenter, { props: { center } })

    expect(wrapper.findAll('[data-iris-notification]')).toHaveLength(2)
    expect(wrapper.find('[data-iris-notifications-badge]').text()).toBe('2')

    // click the first item's body → marks read → badge drops to 1
    await wrapper.find('[data-iris-notification-body]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-iris-notifications-badge]').text()).toBe('1')

    // dismiss the first item → one left
    await wrapper.find('[data-iris-notification-dismiss]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-iris-notification]')).toHaveLength(1)

    wrapper.unmount()
  })

  it('mark-all clears the badge, clear empties the list', async () => {
    const center = createNotificationCenter({ initial: [{ title: 'A' }, { title: 'B' }] })
    const wrapper = mount(IrisNotificationCenter, { props: { center } })

    await wrapper.find('[data-iris-notifications-mark-all]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-iris-notifications-badge]').exists()).toBe(false)

    await wrapper.find('[data-iris-notifications-clear]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-iris-notifications-empty]').exists()).toBe(true)

    wrapper.unmount()
  })
})
