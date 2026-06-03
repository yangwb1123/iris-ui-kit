import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisAdminBreadcrumb } from './AdminBreadcrumb'
import type { NavNode } from '@iris-ui/core'

const trail: NavNode[] = [
  { key: 'sys', title: 'System', icon: 'folder' },
  { key: 'settings', title: 'Settings' },
  { key: 'profile', title: 'Profile' },
]

describe('IrisAdminBreadcrumb', () => {
  it('renders a crumb per trail node and marks the last current', () => {
    const w = mount(IrisAdminBreadcrumb, { props: { trail } })
    const items = w.findAll('[data-iris-breadcrumb-item]')
    expect(items).toHaveLength(3)
    expect(w.find('[data-iris-breadcrumb-last="true"]').text()).toContain('Profile')
    expect(w.find('[aria-current="page"]').exists()).toBe(true)
  })

  it('emits select for an ancestor crumb but not the current one', async () => {
    const w = mount(IrisAdminBreadcrumb, { props: { trail } })
    const crumbs = w.findAll('[data-iris-admin-crumb]')
    await crumbs[0]!.trigger('click') // System
    await crumbs[2]!.trigger('click') // Profile (current — no emit)
    expect(w.emitted('select')).toHaveLength(1)
    expect(w.emitted('select')![0]).toEqual(['sys', trail[0]])
  })

  it('renders nothing for an empty trail, and respects hideSingle', () => {
    expect(
      mount(IrisAdminBreadcrumb, { props: { trail: [] } })
        .find('nav')
        .exists(),
    ).toBe(false)
    const single = mount(IrisAdminBreadcrumb, {
      props: { trail: [trail[0]!], hideSingle: true },
    })
    expect(single.find('nav').exists()).toBe(false)
  })
})
