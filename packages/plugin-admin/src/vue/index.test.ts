import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { IrisAdminApp } from './index'
import type { AdminAppSchema } from '../core'

const schema: AdminAppSchema = {
  title: 'Demo CMS',
  nav: [
    { key: 'users', title: 'Users' },
    { key: 'dash', title: 'Dashboard' },
  ],
  pages: [
    {
      type: 'data',
      key: 'users',
      title: 'Users',
      columns: [
        { key: 'name', title: 'Name' },
        { key: 'role', title: 'Role', dataIndex: 'roleName' },
      ],
      data: [
        { name: 'Ada', roleName: 'Admin' },
        { name: 'Linus', roleName: 'Maintainer' },
      ],
    },
    { type: 'custom', key: 'dash', title: 'Dashboard' },
  ],
}

const mountApp = () =>
  mount(IrisAdminApp, {
    props: {
      schema,
      renderPage: (key: string) => h('div', { 'data-custom': key }, `Custom ${key}`),
    },
    attachTo: document.body,
  })

describe('IrisAdminApp (vue)', () => {
  it('renders the admin shell + a data page from the schema', async () => {
    const wrapper = mountApp()
    expect(wrapper.find('[data-iris-admin-layout]').exists()).toBe(true)
    // first leaf 'users' is a data page → the table renders the client dataset.
    await flushPromises()
    await nextTick()
    expect(wrapper.find('[data-iris-admin-data-page="users"]').exists()).toBe(true)
    expect(wrapper.find('[data-iris-admin-table]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Ada')
    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.find('[data-iris-admin-pager]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders a custom page via renderPage when navigated', async () => {
    const wrapper = mountApp()
    await flushPromises()
    await nextTick()
    const navItems = wrapper.findAll('[data-iris-nav-item]')
    const dash = navItems.find((n) => n.text().includes('Dashboard'))!
    await dash.trigger('click')
    await flushPromises()
    await nextTick()
    expect(wrapper.find('[data-custom="dash"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Custom dash')
    wrapper.unmount()
  })
})
