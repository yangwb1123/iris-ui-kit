import { useState } from 'react'
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
} from '@iris-ui/react'
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
import { notify } from '../notifications'

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
 * The flagship CRUD resource. List + sort + filter + pagination + selection come
 * from `useResourceController` over `createClientFetcher` (the same framework-
 * agnostic engine the Vue/Solid/Svelte demos use). Create / Edit go through a
 * Drawer form; Delete confirms in a Dialog; a bulk delete acts on the selection
 * — all routed through `controller.mutate` (optimistic for deletes, with toasts
 * on success / failure). The in-memory store persists for the session.
 */
export function UsersPage() {
  const { session } = useAuth()
  const canWrite = session?.role === 'admin'
  const toast = useToast()
  const users = useResourceController<User>({ fetcher: fetchUsers, pageSize: 6 })

  const [draft, setDraft] = useState<UserDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)

  const pageIds = users.state.rows.map((u) => String(u.id))
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => users.selection.isSelected(id))
  const selectedIds = users.state.selectedKeys.map(Number)

  const ariaSort = (key: string): 'ascending' | 'descending' | 'none' =>
    users.state.sort?.key === key
      ? users.state.sort.direction === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none'
  const sortGlyph = (key: string) =>
    users.state.sort?.key === key ? (users.state.sort.direction === 'asc' ? ' ▲' : ' ▼') : ''

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyDraft)
    setDrawerOpen(true)
  }
  const openEdit = (u: User) => {
    setEditingId(u.id)
    setDraft({ name: u.name, email: u.email, role: u.role, status: u.status })
    setDrawerOpen(true)
  }

  const saveDraft = async () => {
    if (!draft.name.trim() || !draft.email.trim()) {
      toast.warning({ title: 'Name and email are required' })
      return
    }
    const isEdit = editingId !== null
    setDrawerOpen(false)
    try {
      // Plain action-then-reload: the row id is assigned by the store on create,
      // so we reload to render the canonical row rather than an optimistic guess.
      await users.mutate(async () => {
        if (isEdit) updateUser(editingId!, draft)
        else createUser(draft)
      })
      const title = isEdit ? 'User updated' : 'User created'
      toast.success({ title, description: draft.name })
      notify({ title, description: draft.name, tone: 'success' })
    } catch {
      toast.error({ title: 'Save failed', description: 'Your change was rolled back.' })
      notify({ title: 'Save failed', description: draft.name, tone: 'error' })
    }
  }

  const doDelete = async (u: User) => {
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
      notify({ title: 'User deleted', description: u.name, tone: 'success' })
    } catch {
      toast.error({ title: 'Delete failed', description: 'The user was restored.' })
      notify({ title: 'Delete failed', description: u.name, tone: 'error' })
    }
  }

  const doBulkDelete = async () => {
    const ids = [...selectedIds]
    setConfirmBulk(false)
    try {
      await users.mutate(
        async () => {
          removeUsers(ids)
        },
        { optimistic: (rows) => rows.filter((r) => !ids.includes(r.id)) },
      )
      users.selection.clear()
      const title = `${ids.length} user${ids.length === 1 ? '' : 's'} deleted`
      toast.success({ title })
      notify({ title, tone: 'success' })
    } catch {
      toast.error({ title: 'Bulk delete failed', description: 'Selection was restored.' })
      notify({ title: 'Bulk delete failed', tone: 'error' })
    }
  }

  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="page-title">All users</h1>
          <p className="page-desc" style={{ marginBottom: 12 }}>
            Real CRUD on a live in-memory store via <code>createResourceController</code> +{' '}
            <code>createClientFetcher</code> — sort, filter, paginate, select, and{' '}
            <code>mutate</code> (optimistic deletes), all from @iris-ui/core.
            {users.state.selectedKeys.length > 0 &&
              ` · ${users.state.selectedKeys.length} selected`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selectedIds.length > 0 && canWrite && (
            <IrisButton variant="outline" onClick={() => setConfirmBulk(true)}>
              <IrisIcon name="x" size={16} /> Delete {selectedIds.length}
            </IrisButton>
          )}
          {canWrite && (
            <IrisButton variant="solid" onClick={openCreate}>
              <IrisIcon name="plus" size={16} /> New user
            </IrisButton>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 280, marginBottom: 12 }}>
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
            {canWrite && (
              <th scope="col" style={{ width: 120, textAlign: 'end' }}>
                Actions
              </th>
            )}
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
              {canWrite && (
                <td style={{ textAlign: 'end' }}>
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    <IrisButton size="sm" variant="ghost" onClick={() => openEdit(u)}>
                      Edit
                    </IrisButton>
                    <IrisButton size="sm" variant="ghost" onClick={() => setConfirmDelete(u)}>
                      Delete
                    </IrisButton>
                  </span>
                </td>
              )}
            </tr>
          ))}
          {users.state.rows.length === 0 && (
            <tr>
              <td colSpan={canWrite ? 5 : 4} style={{ color: 'var(--iris-muted)', padding: 24 }}>
                No users match the current filter.
              </td>
            </tr>
          )}
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

      {/* Create / Edit drawer with a form. */}
      <IrisDrawer open={drawerOpen} onOpenChange={setDrawerOpen} side="right" size="380px">
        <IrisDrawerContent>
          <IrisDrawerTitle>{editingId !== null ? 'Edit user' : 'New user'}</IrisDrawerTitle>
          <div style={{ padding: 16 }}>
            <IrisStack spacing={16}>
              <IrisFormField label="Name" required>
                <IrisInput
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  aria-label="Name"
                />
              </IrisFormField>
              <IrisFormField label="Email" required>
                <IrisInput
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                  aria-label="Email"
                />
              </IrisFormField>
              <IrisFormField label="Role">
                <IrisSelect<UserRole>
                  items={roleItems}
                  value={draft.role}
                  onValueChange={(role) => setDraft((d) => ({ ...d, role }))}
                  style={{ width: '100%' }}
                />
              </IrisFormField>
              <IrisFormField label="Status">
                <IrisSelect<UserStatus>
                  items={statusItems}
                  value={draft.status}
                  onValueChange={(status) => setDraft((d) => ({ ...d, status }))}
                  style={{ width: '100%' }}
                />
              </IrisFormField>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <IrisButton variant="ghost" onClick={() => setDrawerOpen(false)}>
                  Cancel
                </IrisButton>
                <IrisButton variant="solid" onClick={saveDraft}>
                  {editingId !== null ? 'Save changes' : 'Create user'}
                </IrisButton>
              </div>
            </IrisStack>
          </div>
        </IrisDrawerContent>
      </IrisDrawer>

      {/* Delete confirmation. */}
      <IrisDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <IrisDialogContent>
          <IrisDialogTitle>Delete user?</IrisDialogTitle>
          <IrisDialogDescription>
            {confirmDelete ? `“${confirmDelete.name}” will be removed. This can't be undone.` : ''}
          </IrisDialogDescription>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <IrisButton variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </IrisButton>
            <IrisButton variant="solid" onClick={() => confirmDelete && doDelete(confirmDelete)}>
              Delete
            </IrisButton>
          </div>
        </IrisDialogContent>
      </IrisDialog>

      {/* Bulk delete confirmation. */}
      <IrisDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <IrisDialogContent>
          <IrisDialogTitle>Delete {selectedIds.length} users?</IrisDialogTitle>
          <IrisDialogDescription>
            The selected users will be removed. This can&apos;t be undone.
          </IrisDialogDescription>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <IrisButton variant="ghost" onClick={() => setConfirmBulk(false)}>
              Cancel
            </IrisButton>
            <IrisButton variant="solid" onClick={doBulkDelete}>
              Delete selected
            </IrisButton>
          </div>
        </IrisDialogContent>
      </IrisDialog>
    </section>
  )
}
