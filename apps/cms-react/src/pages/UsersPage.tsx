import {
  IrisAvatar,
  IrisBadge,
  IrisCheckbox,
  IrisPagination,
  useResourceController,
} from '@iris-ui/react'

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
export function UsersPage() {
  const users = useResourceController<User>({ fetcher: fetchUsers, pageSize: 4 })
  const pageIds = users.state.rows.map((u) => String(u.id))
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => users.selection.isSelected(id))

  return (
    <section>
      <h1 className="page-title">All users</h1>
      <p className="page-desc">
        Driven by <code>createResourceController</code> (server pagination + selection) from
        @iris-ui/core — the L4 composite, rendered with Iris primitives.
        {users.state.selectedKeys.length > 0 && ` · ${users.state.selectedKeys.length} selected`}
      </p>
      <table className="cms-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <IrisCheckbox
                checked={allOnPage}
                onChange={() => users.selection.toggleAll(pageIds)}
                aria-label="Select all on page"
              />
            </th>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.state.rows.map((u) => (
            <tr key={u.id}>
              <td>
                <IrisCheckbox
                  checked={users.selection.isSelected(String(u.id))}
                  onChange={() => users.selection.toggle(String(u.id))}
                  aria-label={`Select ${u.name}`}
                />
              </td>
              <td>
                <span className="cms-user">
                  <IrisAvatar name={u.name} size={32} />
                  <span>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ color: 'var(--iris-muted)', fontSize: 12 }}>{u.email}</div>
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
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16 }}>
        <IrisPagination
          value={users.state.page}
          total={users.state.total}
          pageSize={users.state.pageSize}
          onValueChange={(p) => users.setPage(p)}
        />
      </div>
    </section>
  )
}
