import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/svelte'
import type { AdminAppSchema } from '../core'
import IrisAdminAppHost from './IrisAdminAppHost.svelte'

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

describe('IrisAdminApp (svelte)', () => {
  it('renders the admin shell + a data page from the schema', async () => {
    const { container, findByText } = render(IrisAdminAppHost, { props: { schema } })
    expect(container.querySelector('[data-iris-admin-layout]')).toBeTruthy()
    // first leaf 'users' is a data page → the table renders the client dataset.
    await findByText('Ada')
    expect(container.querySelector('[data-iris-admin-data-page="users"]')).toBeTruthy()
    expect(container.querySelector('[data-iris-admin-table]')).toBeTruthy()
    expect(await findByText('Admin')).toBeTruthy()
    expect(container.querySelector('[data-iris-admin-pager]')).toBeTruthy()
  })

  it('renders a custom page via renderPage when navigated', async () => {
    const { container, findByText } = render(IrisAdminAppHost, { props: { schema } })
    await findByText('Ada')
    const navItems = Array.from(container.querySelectorAll<HTMLElement>('[data-iris-nav-item]'))
    const dash = navItems.find((n) => n.textContent?.includes('Dashboard'))!
    await fireEvent.click(dash)
    await waitFor(() => expect(container.querySelector('[data-custom="dash"]')).toBeTruthy())
  })

  it('creates, validates, edits and deletes rows through the shared controller', async () => {
    const editable: AdminAppSchema = {
      nav: [{ key: 'users', title: 'Users' }],
      pages: [
        {
          type: 'data',
          key: 'users',
          rowKey: 'id',
          editable: true,
          columns: [
            { key: 'id', title: 'ID', type: 'number', required: true },
            { key: 'name', title: 'Name', required: true },
          ],
          data: [{ id: 1, name: 'Ada' }],
        },
      ],
    }
    const view = render(IrisAdminAppHost, { props: { schema: editable } })
    await view.findByText('Ada')

    await fireEvent.click(view.getByRole('button', { name: 'Create' }))
    await fireEvent.submit(view.container.querySelector('form')!)
    expect(await view.findByText('ID is required.')).toBeTruthy()
    await fireEvent.input(view.container.querySelector('#iris-admin-users-id')!, {
      target: { value: '2' },
    })
    await fireEvent.input(view.container.querySelector('#iris-admin-users-name')!, {
      target: { value: 'Grace' },
    })
    await fireEvent.submit(view.container.querySelector('form')!)
    await view.findByText('Grace')

    let row = Array.from(view.container.querySelectorAll('tbody tr')).find((item) =>
      item.textContent?.includes('Grace'),
    )!
    await fireEvent.click(
      Array.from(row.querySelectorAll('button')).find(
        (item) => item.textContent?.trim() === 'Edit',
      )!,
    )
    await fireEvent.input(view.container.querySelector('#iris-admin-users-name')!, {
      target: { value: 'Grace Hopper' },
    })
    await fireEvent.submit(view.container.querySelector('form')!)
    await view.findByText('Grace Hopper')

    row = Array.from(view.container.querySelectorAll('tbody tr')).find((item) =>
      item.textContent?.includes('Grace Hopper'),
    )!
    await fireEvent.click(
      Array.from(row.querySelectorAll('button')).find(
        (item) => item.textContent?.trim() === 'Delete',
      )!,
    )
    await fireEvent.click(
      Array.from(row.querySelectorAll('button')).find(
        (item) => item.textContent?.trim() === 'Confirm delete',
      )!,
    )
    await waitFor(() => expect(view.queryByText('Grace Hopper')).toBeNull())
  })
})
