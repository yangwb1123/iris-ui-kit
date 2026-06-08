import {
  IrisAvatar,
  IrisBadge,
  IrisCheckbox,
  IrisInput,
  IrisPagination,
  createClientFetcher,
  useResourceController,
  type DataViewColumn,
} from '@iris-ui/react'

type Status = 'active' | 'invited' | 'suspended'
interface User {
  id: number
  name: string
  email: string
  role: string
  status: Status
}

const ALL: User[] = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@iris.dev', role: 'Owner', status: 'active' },
  { id: 2, name: 'Alan Turing', email: 'alan@iris.dev', role: 'Admin', status: 'active' },
  { id: 3, name: 'Grace Hopper', email: 'grace@iris.dev', role: 'Editor', status: 'invited' },
  { id: 4, name: 'Linus T.', email: 'linus@iris.dev', role: 'Viewer', status: 'suspended' },
  { id: 5, name: 'Margaret H.', email: 'margaret@iris.dev', role: 'Admin', status: 'active' },
  { id: 6, name: 'Dennis R.', email: 'dennis@iris.dev', role: 'Editor', status: 'invited' },
  { id: 7, name: 'Barbara L.', email: 'barbara@iris.dev', role: 'Viewer', status: 'active' },
]

// Column accessors drive the controller's client-side filter/sort.
const columns: DataViewColumn<User>[] = [
  { key: 'name', getValue: (u) => u.name, filterable: true },
  { key: 'role', getValue: (u) => u.role },
]
// Client-mode: filter + sort + paginate the in-memory dataset (no backend).
const fetchUsers = createClientFetcher(ALL, columns)

const tone = (s: Status): 'success' | 'warning' | 'danger' =>
  s === 'active' ? 'success' : s === 'invited' ? 'warning' : 'danger'

/** Tri-state header sort cycle: none → asc → desc → none. */
type Sort = { key: string; direction: 'asc' | 'desc' } | null
function nextSort(current: Sort, key: string): Sort {
  if (!current || current.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
}

/**
 * A real CRUD list driven by the framework-agnostic `createResourceController`
 * (via `useResourceController`) in client mode (`createClientFetcher`): keyword
 * filter, sortable columns, pagination, and the composed selection model —
 * rendered with Iris primitives.
 */
export function UsersPage() {
  const users = useResourceController<User>({ fetcher: fetchUsers, pageSize: 4 })
  const pageIds = users.state.rows.map((u) => String(u.id))
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => users.selection.isSelected(id))

  const ariaSort = (key: string): 'ascending' | 'descending' | 'none' =>
    users.state.sort?.key === key
      ? users.state.sort.direction === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none'
  const sortGlyph = (key: string) =>
    users.state.sort?.key === key ? (users.state.sort.direction === 'asc' ? ' ▲' : ' ▼') : ''

  return (
    <section>
      <h1 className="page-title">All users</h1>
      <p className="page-desc">
        Driven by <code>createResourceController</code> in client mode (
        <code>createClientFetcher</code>) — keyword filter + sortable columns + pagination +
        selection, all from @iris-ui/core.
        {users.state.selectedKeys.length > 0 && ` · ${users.state.selectedKeys.length} selected`}
      </p>
      <div style={{ maxWidth: 260, marginBottom: 12 }}>
        <IrisInput
          value={users.state.filters.name ?? ''}
          onChange={(e) => users.setFilter('name', e.target.value)}
          placeholder="Filter by name…"
          aria-label="Filter users by name"
        />
      </div>
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
            <th
              scope="col"
              aria-sort={ariaSort('name')}
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => users.setSort(nextSort(users.state.sort, 'name'))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  users.setSort(nextSort(users.state.sort, 'name'))
                }
              }}
            >
              User
              <span aria-hidden="true">{sortGlyph('name')}</span>
            </th>
            <th
              scope="col"
              aria-sort={ariaSort('role')}
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => users.setSort(nextSort(users.state.sort, 'role'))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  users.setSort(nextSort(users.state.sort, 'role'))
                }
              }}
            >
              Role
              <span aria-hidden="true">{sortGlyph('role')}</span>
            </th>
            <th scope="col">Status</th>
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
