import { createSignal, For, Show, type JSX } from 'solid-js'
import {
  IrisAvatar,
  IrisBadge,
  IrisButton,
  IrisCheckbox,
  IrisDialog,
  IrisDialogContent,
  IrisDialogTitle,
  IrisDialogDescription,
  IrisDrawer,
  IrisDrawerContent,
  IrisDrawerTitle,
  IrisFormField,
  IrisIcon,
  IrisInput,
  IrisPagination,
  IrisSelect,
  IrisStack,
  useResourceController,
  useToast,
  type IrisSelectItem,
} from '@iris-ui/solid'
import {
  createUser,
  fetchUsers,
  removeUser,
  removeUsers,
  updateUser,
  USER_ROLES,
  USER_STATUSES,
  type User,
  type UserDraft,
  type UserRole,
  type UserStatus,
} from '../data/users'
import { useAuth } from '../auth'

const roleItems: IrisSelectItem<UserRole>[] = USER_ROLES.map((r) => ({ value: r, label: r }))
const statusItems: IrisSelectItem<UserStatus>[] = USER_STATUSES.map((s) => ({ value: s, label: s }))

const tone = (s: UserStatus): 'success' | 'warning' | 'danger' =>
  s === 'active' ? 'success' : s === 'invited' ? 'warning' : 'danger'

/** Tri-state header sort cycle: none → asc → desc → none. */
type Sort = { key: string; direction: 'asc' | 'desc' } | null
function nextSort(current: Sort, key: string): Sort {
  if (!current || current.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
}

const emptyDraft: UserDraft = { name: '', email: '', role: 'Viewer', status: 'invited' }

/**
 * The flagship CRUD resource (Solid). List + sort + filter + pagination +
 * selection come from `useResourceController` over `createClientFetcher` (the
 * same framework-agnostic engine the React/Vue/Svelte demos use). Create / Edit
 * go through a Drawer form; Delete confirms in a Dialog; a bulk delete acts on
 * the selection — all routed through `controller.mutate` (optimistic for
 * deletes, with toasts on success / failure). The in-memory store persists for
 * the session. Mirrors cms-react/src/pages/UsersPage.tsx in Solid's idiom.
 */
export function UsersPage(): JSX.Element {
  const auth = useAuth()
  const canWrite = (): boolean => auth.session?.role === 'admin'
  const toast = useToast()
  const users = useResourceController<User>({ fetcher: fetchUsers, pageSize: 6 })

  const [draft, setDraft] = createSignal<UserDraft>(emptyDraft)
  const [editingId, setEditingId] = createSignal<number | null>(null)
  const [drawerOpen, setDrawerOpen] = createSignal(false)
  const [confirmDelete, setConfirmDelete] = createSignal<User | null>(null)
  const [confirmBulk, setConfirmBulk] = createSignal(false)

  const pageIds = (): string[] => users.state().rows.map((u) => String(u.id))
  const allOnPage = (): boolean => {
    const ids = pageIds()
    return ids.length > 0 && ids.every((id) => users.selection.isSelected(id))
  }
  const selectedIds = (): number[] => users.state().selectedKeys.map(Number)

  const ariaSort = (key: string): 'ascending' | 'descending' | 'none' => {
    const sort = users.state().sort
    return sort?.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
  }
  const sortGlyph = (key: string): string => {
    const sort = users.state().sort
    return sort?.key === key ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''
  }
  const toggleSort = (key: string): void => users.setSort(nextSort(users.state().sort, key))

  const openCreate = (): void => {
    setEditingId(null)
    setDraft(emptyDraft)
    setDrawerOpen(true)
  }
  const openEdit = (u: User): void => {
    setEditingId(u.id)
    setDraft({ name: u.name, email: u.email, role: u.role, status: u.status })
    setDrawerOpen(true)
  }

  const saveDraft = async (): Promise<void> => {
    const d = draft()
    if (!d.name.trim() || !d.email.trim()) {
      toast.warning({ title: 'Name and email are required' })
      return
    }
    const id = editingId()
    const isEdit = id !== null
    setDrawerOpen(false)
    try {
      // Plain action-then-reload: the row id is assigned by the store on create,
      // so we reload to render the canonical row rather than an optimistic guess.
      await users.mutate(async () => {
        if (isEdit) updateUser(id, d)
        else createUser(d)
      })
      toast.success({ title: isEdit ? 'User updated' : 'User created', description: d.name })
    } catch {
      toast.error({ title: 'Save failed', description: 'Your change was rolled back.' })
    }
  }

  const doDelete = async (u: User): Promise<void> => {
    setConfirmDelete(null)
    try {
      // Optimistic: drop the row immediately; the controller rolls back if the
      // action rejects.
      await users.mutate(
        async () => {
          removeUser(u.id)
        },
        { optimistic: (rows) => rows.filter((r) => r.id !== u.id) },
      )
      users.selection.deselect(String(u.id))
      toast.success({ title: 'User deleted', description: u.name })
    } catch {
      toast.error({ title: 'Delete failed', description: 'The user was restored.' })
    }
  }

  const doBulkDelete = async (): Promise<void> => {
    const ids = [...selectedIds()]
    setConfirmBulk(false)
    try {
      await users.mutate(
        async () => {
          removeUsers(ids)
        },
        { optimistic: (rows) => rows.filter((r) => !ids.includes(r.id)) },
      )
      users.selection.clear()
      toast.success({ title: `${ids.length} user${ids.length === 1 ? '' : 's'} deleted` })
    } catch {
      toast.error({ title: 'Bulk delete failed', description: 'Selection was restored.' })
    }
  }

  return (
    <section>
      <div
        style={{
          display: 'flex',
          'align-items': 'flex-start',
          'justify-content': 'space-between',
          gap: '16px',
          'flex-wrap': 'wrap',
        }}
      >
        <div>
          <h1 class="page-title">All users</h1>
          <p class="page-desc" style={{ 'margin-bottom': '12px' }}>
            Real CRUD on a live in-memory store via <code>createResourceController</code> +{' '}
            <code>createClientFetcher</code> — sort, filter, paginate, select, and{' '}
            <code>mutate</code> (optimistic deletes), all from @iris-ui/core.
            {users.state().selectedKeys.length > 0
              ? ` · ${users.state().selectedKeys.length} selected`
              : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Show when={selectedIds().length > 0 && canWrite()}>
            <IrisButton variant="outline" onClick={() => setConfirmBulk(true)}>
              <IrisIcon name="x" size={16} /> Delete {selectedIds().length}
            </IrisButton>
          </Show>
          <Show when={canWrite()}>
            <IrisButton variant="solid" onClick={openCreate}>
              <IrisIcon name="plus" size={16} /> New user
            </IrisButton>
          </Show>
        </div>
      </div>

      <div style={{ 'max-width': '280px', 'margin-bottom': '12px' }}>
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
            <Show when={canWrite()}>
              <th scope="col" style={{ width: '120px', 'text-align': 'end' }}>
                Actions
              </th>
            </Show>
          </tr>
        </thead>
        <tbody>
          <For each={users.state().rows}>
            {(u) => (
              <tr>
                <td>
                  <IrisCheckbox
                    checked={users.selection.isSelected(String(u.id))}
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
                <Show when={canWrite()}>
                  <td style={{ 'text-align': 'end' }}>
                    <span style={{ display: 'inline-flex', gap: '6px' }}>
                      <IrisButton size="sm" variant="ghost" onClick={() => openEdit(u)}>
                        Edit
                      </IrisButton>
                      <IrisButton size="sm" variant="ghost" onClick={() => setConfirmDelete(u)}>
                        Delete
                      </IrisButton>
                    </span>
                  </td>
                </Show>
              </tr>
            )}
          </For>
          <Show when={users.state().rows.length === 0}>
            <tr>
              <td
                colSpan={canWrite() ? 5 : 4}
                style={{ color: 'var(--iris-muted)', padding: '24px' }}
              >
                No users match the current filter.
              </td>
            </tr>
          </Show>
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

      {/* Create / Edit drawer with a form. */}
      <IrisDrawer open={drawerOpen()} onOpenChange={setDrawerOpen} side="right" size="380px">
        <IrisDrawerContent>
          <IrisDrawerTitle>{editingId() !== null ? 'Edit user' : 'New user'}</IrisDrawerTitle>
          <div style={{ padding: '16px' }}>
            <IrisStack spacing={16}>
              <IrisFormField label="Name" required>
                <IrisInput
                  value={draft().name}
                  onInput={(e) => setDraft((d) => ({ ...d, name: e.currentTarget.value }))}
                  aria-label="Name"
                />
              </IrisFormField>
              <IrisFormField label="Email" required>
                <IrisInput
                  type="email"
                  value={draft().email}
                  onInput={(e) => setDraft((d) => ({ ...d, email: e.currentTarget.value }))}
                  aria-label="Email"
                />
              </IrisFormField>
              <IrisFormField label="Role">
                <IrisSelect<UserRole>
                  items={roleItems}
                  value={draft().role}
                  onChange={(role) => setDraft((d) => ({ ...d, role }))}
                  style={{ width: '100%' }}
                />
              </IrisFormField>
              <IrisFormField label="Status">
                <IrisSelect<UserStatus>
                  items={statusItems}
                  value={draft().status}
                  onChange={(status) => setDraft((d) => ({ ...d, status }))}
                  style={{ width: '100%' }}
                />
              </IrisFormField>
              <div style={{ display: 'flex', gap: '8px', 'justify-content': 'flex-end' }}>
                <IrisButton variant="ghost" onClick={() => setDrawerOpen(false)}>
                  Cancel
                </IrisButton>
                <IrisButton variant="solid" onClick={() => void saveDraft()}>
                  {editingId() !== null ? 'Save changes' : 'Create user'}
                </IrisButton>
              </div>
            </IrisStack>
          </div>
        </IrisDrawerContent>
      </IrisDrawer>

      {/* Delete confirmation. */}
      <IrisDialog
        open={confirmDelete() !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <IrisDialogContent>
          <IrisDialogTitle>Delete user?</IrisDialogTitle>
          <IrisDialogDescription>
            {confirmDelete()
              ? `“${confirmDelete()!.name}” will be removed. This can't be undone.`
              : ''}
          </IrisDialogDescription>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              'justify-content': 'flex-end',
              'margin-top': '16px',
            }}
          >
            <IrisButton variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </IrisButton>
            <IrisButton
              variant="solid"
              onClick={() => {
                const u = confirmDelete()
                if (u) void doDelete(u)
              }}
            >
              Delete
            </IrisButton>
          </div>
        </IrisDialogContent>
      </IrisDialog>

      {/* Bulk delete confirmation. */}
      <IrisDialog open={confirmBulk()} onOpenChange={setConfirmBulk}>
        <IrisDialogContent>
          <IrisDialogTitle>Delete {selectedIds().length} users?</IrisDialogTitle>
          <IrisDialogDescription>
            The selected users will be removed. This can't be undone.
          </IrisDialogDescription>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              'justify-content': 'flex-end',
              'margin-top': '16px',
            }}
          >
            <IrisButton variant="ghost" onClick={() => setConfirmBulk(false)}>
              Cancel
            </IrisButton>
            <IrisButton variant="solid" onClick={() => void doBulkDelete()}>
              Delete selected
            </IrisButton>
          </div>
        </IrisDialogContent>
      </IrisDialog>
    </section>
  )
}
