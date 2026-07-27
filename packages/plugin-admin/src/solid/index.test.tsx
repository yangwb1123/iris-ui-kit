import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, fireEvent, waitFor, within } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { vi } from 'vitest'
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

describe('IrisAdminApp (solid)', () => {
  it('renders the admin shell + a data page from the schema', async () => {
    const { container, findByText } = render(() => (
      <IrisAdminApp
        schema={schema}
        renderPage={(key) => <div data-custom={key}>Custom {key}</div>}
      />
    ))
    expect(container.querySelector('[data-iris-admin-layout]')).toBeTruthy()
    // first leaf 'users' is a data page → the table renders the client dataset.
    await findByText('Ada')
    expect(container.querySelector('[data-iris-admin-data-page="users"]')).toBeTruthy()
    expect(container.querySelector('[data-iris-admin-table]')).toBeTruthy()
    expect(await findByText('Admin')).toBeTruthy()
    expect(container.querySelector('[data-iris-admin-pager]')).toBeTruthy()
  })

  it('renders a custom page via renderPage when navigated', async () => {
    const { container, findByText } = render(() => (
      <IrisAdminApp
        schema={schema}
        renderPage={(key) => <div data-custom={key}>Custom {key}</div>}
      />
    ))
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
            { key: 'name', title: 'Name', required: true },
          ],
          data: [{ id: 1, name: 'Ada' }],
        },
      ],
    }
    const view = render(() => <IrisAdminApp schema={editable} messages={{ create: 'Add user' }} />)
    await view.findByText('Ada')

    fireEvent.click(view.getByRole('button', { name: 'Add user' }))
    const form = view.getByRole('form', { name: 'Create Users' })
    fireEvent.submit(form)
    const error = await view.findByText('ID is required.')
    expect(error.getAttribute('role')).toBe('alert')
    const idInput = view.getByLabelText('ID *')
    expect(idInput.getAttribute('aria-invalid')).toBe('true')
    expect(idInput.getAttribute('aria-describedby')).toBe(error.id)

    fireEvent.input(idInput, { target: { value: '2' } })
    fireEvent.input(view.getByLabelText('Name *'), { target: { value: 'Grace' } })
    fireEvent.submit(form)

    const grace = await view.findByText('Grace')
    const graceRow = grace.closest('tr')!
    expect(graceRow.getAttribute('data-row-key')).toBe('2')
    fireEvent.click(within(graceRow).getByRole('button', { name: 'Edit' }))
    fireEvent.input(view.getByLabelText('Name *'), {
      target: { value: 'Grace Hopper' },
    })
    fireEvent.submit(view.getByRole('form', { name: 'Edit Users' }))
    const hopper = await view.findByText('Grace Hopper')

    const hopperRow = hopper.closest('tr')!
    fireEvent.click(within(hopperRow).getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(hopperRow).getByRole('button', { name: 'Confirm delete' }))
    await waitFor(() => expect(view.queryByText('Grace Hopper')).toBeNull())
  })

  it('forwards server sort and filter query state and keeps stable row keys', async () => {
    const fetcher = vi.fn(async () => ({
      rows: [{ userId: 'user-1', name: 'Ada' }],
      total: 1,
    }))
    const serverSchema: AdminAppSchema = {
      nav: [{ key: 'users', title: 'Users' }],
      pages: [
        {
          type: 'data',
          key: 'users',
          title: 'Users',
          rowKey: 'userId',
          fetcher,
          columns: [
            {
              key: 'name',
              title: 'Name',
              sortable: true,
              filterable: true,
            },
          ],
        },
      ],
    }
    const view = render(() => <IrisAdminApp schema={serverSchema} />)
    const ada = await view.findByText('Ada')
    expect(ada.closest('tr')?.getAttribute('data-row-key')).toBe('user-1')

    fireEvent.click(view.getByRole('button', { name: 'Name' }))
    await waitFor(() =>
      expect(fetcher).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          sort: { key: 'name', direction: 'asc' },
        }),
      ),
    )

    fireEvent.input(view.getByRole('searchbox', { name: 'Filter Name' }), {
      target: { value: 'Ada' },
    })
    await waitFor(() =>
      expect(fetcher).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          filters: expect.objectContaining({ name: 'Ada' }),
        }),
      ),
    )
  })

  it('gates standard and custom actions by reactive permissions', async () => {
    const restricted: AdminAppSchema = {
      nav: [{ key: 'users', title: 'Users' }],
      pages: [
        {
          type: 'data',
          key: 'users',
          rowKey: 'id',
          editable: true,
          permissions: {
            create: 'users.write',
            update: false,
            delete: false,
          },
          actions: [{ key: 'audit', label: 'Audit', permission: 'users.audit' }],
          columns: [{ key: 'name', title: 'Name' }],
          data: [{ id: 1, name: 'Ada' }],
        },
      ],
    }
    const onAction = vi.fn()
    const [permissions, setPermissions] = createSignal<readonly string[]>([])
    const view = render(() => (
      <IrisAdminApp schema={restricted} permissions={permissions()} onAction={onAction} />
    ))
    await view.findByText('Ada')
    expect(view.queryByRole('button', { name: 'Create' })).toBeNull()
    expect(view.queryByRole('button', { name: 'Audit' })).toBeNull()

    setPermissions(['users.write', 'users.audit'])
    const audit = await view.findByRole('button', { name: 'Audit' })
    expect(view.getByRole('button', { name: 'Create' })).toBeTruthy()
    fireEvent.click(audit)
    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith('users', 'audit', expect.objectContaining({ id: 1 })),
    )
  })
})
