import { For, type JSX } from 'solid-js'
import {
  IrisAvatar,
  IrisBadge,
  IrisCheckbox,
  IrisInput,
  IrisPagination,
  createClientFetcher,
  useResourceController,
  type DataViewColumn,
} from '@iris-ui/solid'

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
export function UsersPage(): JSX.Element {
  const users = useResourceController<User>({ fetcher: fetchUsers, pageSize: 4 })
  const selectedKeys = (): string[] => users.state().selectedKeys
  const pageIds = (): string[] => users.state().rows.map((u) => String(u.id))
  const isSelected = (id: string): boolean => selectedKeys().includes(id)
  const allOnPage = (): boolean => {
    const ids = pageIds()
    return ids.length > 0 && ids.every((id) => isSelected(id))
  }

  const ariaSort = (key: string): 'ascending' | 'descending' | 'none' => {
    const sort = users.state().sort
    return sort?.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
  }
  const sortGlyph = (key: string): string => {
    const sort = users.state().sort
    return sort?.key === key ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''
  }
  const toggleSort = (key: string): void => users.setSort(nextSort(users.state().sort, key))

  return (
    <section>
      <h1 class="page-title">All users</h1>
      <p class="page-desc">
        Driven by <code>createResourceController</code> in client mode (
        <code>createClientFetcher</code>) — keyword filter + sortable columns + pagination +
        selection, all from @iris-ui/core.
        {selectedKeys().length > 0 ? ` · ${selectedKeys().length} selected` : ''}
      </p>
      <div style={{ 'max-width': '260px', 'margin-bottom': '12px' }}>
        <IrisInput
          value={users.state().filters.name ?? ''}
          onInput={(e) => users.setFilter('name', e.currentTarget.value)}
          placeholder="Filter by name…"
          aria-label="Filter users by name"
        />
      </div>
      <table class="cms-table">
        <thead>
          <tr>
            <th style={{ width: '36px' }}>
              <IrisCheckbox
                checked={allOnPage()}
                onChange={() => users.selection.toggleAll(pageIds())}
                aria-label="Select all on page"
              />
            </th>
            <th
              scope="col"
              aria-sort={ariaSort('name')}
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => toggleSort('name')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleSort('name')
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
              onClick={() => toggleSort('role')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleSort('role')
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
          <For each={users.state().rows}>
            {(u) => (
              <tr>
                <td>
                  <IrisCheckbox
                    checked={isSelected(String(u.id))}
                    onChange={() => users.selection.toggle(String(u.id))}
                    aria-label={`Select ${u.name}`}
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
