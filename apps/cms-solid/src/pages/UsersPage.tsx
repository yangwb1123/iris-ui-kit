import { For, type JSX } from 'solid-js'
import {
  IrisAvatar,
  IrisBadge,
  IrisCheckbox,
  IrisPagination,
  useResourceController,
} from '@iris-ui/solid'

type Status = 'active' | 'invited' | 'suspended'
interface User {
  id: number
  name: string
  email: string
  role: string
  status: Status
}

// A small static dataset, served through a mock async fetcher so the page
// exercises the real createResourceController (server-mode) lifecycle.
const ALL: User[] = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@iris.dev', role: 'Owner', status: 'active' },
  { id: 2, name: 'Alan Turing', email: 'alan@iris.dev', role: 'Admin', status: 'active' },
  { id: 3, name: 'Grace Hopper', email: 'grace@iris.dev', role: 'Editor', status: 'invited' },
  { id: 4, name: 'Linus T.', email: 'linus@iris.dev', role: 'Viewer', status: 'suspended' },
  { id: 5, name: 'Margaret H.', email: 'margaret@iris.dev', role: 'Admin', status: 'active' },
  { id: 6, name: 'Dennis R.', email: 'dennis@iris.dev', role: 'Editor', status: 'invited' },
  { id: 7, name: 'Barbara L.', email: 'barbara@iris.dev', role: 'Viewer', status: 'active' },
]

async function fetchUsers({ page, pageSize }: { page: number; pageSize: number }) {
  const start = (page - 1) * pageSize
  return { rows: ALL.slice(start, start + pageSize), total: ALL.length }
}

const tone = (s: Status): 'success' | 'warning' | 'danger' =>
  s === 'active' ? 'success' : s === 'invited' ? 'warning' : 'danger'

/**
 * L4 validation: a real CRUD list driven entirely by the framework-agnostic
 * `createResourceController` (via the `useResourceController` bridge) — server
 * pagination + the composed selection model, rendered with Iris primitives.
 */
export function UsersPage(): JSX.Element {
  const users = useResourceController<User>({ fetcher: fetchUsers, pageSize: 4 })
  const selectedKeys = (): string[] => users.state().selectedKeys
  const pageIds = (): string[] => users.state().rows.map((u) => String(u.id))
  const isSelected = (id: string): boolean => selectedKeys().includes(id)
  const allOnPage = (): boolean => {
    const ids = pageIds()
    return ids.length > 0 && ids.every((id) => isSelected(id))
  }

  return (
    <section>
      <h1 class="page-title">All users</h1>
      <p class="page-desc">
        Driven by <code>createResourceController</code> (server pagination + selection) from
        @iris-ui/core — the L4 composite, rendered with Iris primitives.
        {selectedKeys().length > 0 ? ` · ${selectedKeys().length} selected` : ''}
      </p>
      <table class="cms-table">
        <thead>
          <tr>
            <th style={{ width: '36px' }}>
              <IrisCheckbox
                checked={allOnPage()}
                onChange={() => users.selection.toggleAll(pageIds())}
              />
            </th>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <For each={users.state().rows}>
            {(u) => (
              <tr>
                <td>
                  <IrisCheckbox
                    checked={isSelected(String(u.id))}
                    onChange={() => users.selection.toggle(String(u.id))}
                  />
                </td>
                <td>
                  <span class="cms-user">
                    <IrisAvatar name={u.name} size={32} />
                    <span>
                      <div style={{ 'font-weight': 600 }}>{u.name}</div>
                      <div style={{ color: 'var(--iris-muted)', 'font-size': '12px' }}>
                        {u.email}
                      </div>
                    </span>
                  </span>
                </td>
                <td>{u.role}</td>
                <td>
                  <IrisBadge tone={tone(u.status)} variant="subtle">
                    {u.status}
                  </IrisBadge>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <div style={{ 'margin-top': '16px' }}>
        <IrisPagination
          page={users.state().page}
          total={users.state().total}
          pageSize={users.state().pageSize}
          onChange={(p) => users.setPage(p)}
        />
      </div>
    </section>
  )
}
