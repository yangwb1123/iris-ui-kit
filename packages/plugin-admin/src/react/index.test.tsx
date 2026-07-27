import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, fireEvent, waitFor, within } from '@testing-library/react'
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

  it('creates, validates, edits and deletes rows through the shared controller', async () => {
    const editable: AdminAppSchema = {
      nav: [{ key: 'users', title: 'Users' }],
      pages: [
        {
          type: 'data',
          key: 'users',
          title: 'Users',
          rowKey: 'id',
          editable: true,
          columns: [
            { key: 'id', title: 'ID', type: 'number', required: true },
            { key: 'name', title: 'Name', required: true, sortable: true, filterable: true },
          ],
          data: [{ id: 1, name: 'Ada' }],
        },
      ],
    }
    const view = render(<IrisAdminApp schema={editable} />)
    await view.findByText('Ada')

    fireEvent.click(view.getByRole('button', { name: 'Create' }))
    fireEvent.click(view.getByRole('button', { name: 'Save' }))
    expect(await view.findByText('ID is required.')).toBeTruthy()
    fireEvent.change(view.getByLabelText('ID *'), { target: { value: '2' } })
    fireEvent.change(view.getByLabelText('Name *'), { target: { value: 'Grace' } })
    fireEvent.click(view.getByRole('button', { name: 'Save' }))

    const grace = await view.findByText('Grace')
    const graceRow = grace.closest('tr')!
    fireEvent.click(within(graceRow).getByRole('button', { name: 'Edit' }))
    fireEvent.change(view.getByLabelText('Name *'), { target: { value: 'Grace Hopper' } })
    fireEvent.click(view.getByRole('button', { name: 'Save' }))
    const hopper = await view.findByText('Grace Hopper')

    const hopperRow = hopper.closest('tr')!
    fireEvent.click(within(hopperRow).getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(hopperRow).getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(view.queryByText('Grace Hopper')).toBeNull())
  })

  it('gates standard and custom actions by permissions', async () => {
    const restricted: AdminAppSchema = {
      nav: [{ key: 'users', title: 'Users' }],
      pages: [
        {
          type: 'data',
          key: 'users',
          rowKey: 'id',
          editable: true,
          permissions: { create: 'users.write', update: false, delete: false },
          actions: [{ key: 'audit', label: 'Audit', permission: 'users.audit' }],
          columns: [{ key: 'name', title: 'Name' }],
          data: [{ id: 1, name: 'Ada' }],
        },
      ],
    }
    const onAction = vi.fn()
    const { rerender, queryByRole, findByText } = render(
      <IrisAdminApp schema={restricted} onAction={onAction} />,
    )
    await findByText('Ada')
    expect(queryByRole('button', { name: 'Create' })).toBeNull()
    expect(queryByRole('button', { name: 'Audit' })).toBeNull()

    rerender(
      <IrisAdminApp
        schema={restricted}
        permissions={['users.write', 'users.audit']}
        onAction={onAction}
      />,
    )
    expect(queryByRole('button', { name: 'Create' })).toBeTruthy()
    fireEvent.click(queryByRole('button', { name: 'Audit' })!)
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('users', 'audit', expect.any(Object)))
  })
})
