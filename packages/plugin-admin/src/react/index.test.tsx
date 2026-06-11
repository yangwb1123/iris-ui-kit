import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, fireEvent, waitFor } from '@testing-library/react'
import { IrisAdminApp } from './index'
import type { AdminAppSchema } from '../core'

afterEach(cleanup)

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

describe('IrisAdminApp (react)', () => {
  it('renders the admin shell + a data page from the schema', async () => {
    const { container, findByText } = render(
      <IrisAdminApp
        schema={schema}
        renderPage={(key) => <div data-custom={key}>Custom {key}</div>}
      />,
    )
    expect(container.querySelector('[data-iris-admin-layout]')).toBeTruthy()
    // first leaf 'users' is a data page → the table renders the client dataset.
    await findByText('Ada')
    expect(container.querySelector('[data-iris-admin-data-page="users"]')).toBeTruthy()
    expect(container.querySelector('[data-iris-admin-table]')).toBeTruthy()
    expect(await findByText('Admin')).toBeTruthy()
    expect(container.querySelector('[data-iris-admin-pager]')).toBeTruthy()
  })

  it('renders a custom page via renderPage when navigated', async () => {
    const { container, findByText } = render(
      <IrisAdminApp
        schema={schema}
        renderPage={(key) => <div data-custom={key}>Custom {key}</div>}
      />,
    )
    await findByText('Ada')
    const navItems = Array.from(container.querySelectorAll<HTMLElement>('[data-iris-nav-item]'))
    const dash = navItems.find((n) => n.textContent?.includes('Dashboard'))!
    fireEvent.click(dash)
    await waitFor(() => expect(container.querySelector('[data-custom="dash"]')).toBeTruthy())
  })
})
