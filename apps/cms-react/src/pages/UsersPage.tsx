import { useState } from 'react'
import {
  IrisAvatar,
  IrisBadge,
  IrisButton,
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
  IrisTable,
  useResourceController,
  useToast,
  type IrisSelectItem,
  type IrisTableColumn,
  type IrisTableSortState,
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
  const users = useResourceController<User>({
    fetcher: fetchUsers,
    pageSize: 6,
    // Enable query cache with 10s TTL, circuit breaker, and rate limiting
    // so repeated page/filter/sort requests hit cache, and transient failures
    // are isolated instead of cascading.
    resilient: { ttlMs: 10_000, breaker: { failureThreshold: 3, resetMs: 30_000 } },
  })

  const [draft, setDraft] = useState<UserDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)

  // Bulk-delete uses the controller's selected keys.
  const selectedIds = users.state.selectedKeys.map(Number)

  const columns: IrisTableColumn[] = [
    {
      key: 'user',
      title: 'User',
      sortable: true,
      render: (_value: unknown, row: Record<string, unknown>) => (
        <span className="cms-user">
          <IrisAvatar name={(row as unknown as User).name} size={32} />
          <span>
            <div style={{ fontWeight: 600 }}>{(row as unknown as User).name}</div>
            <div style={{ color: 'var(--iris-muted)', fontSize: 12 }}>
              {(row as unknown as User).email}
            </div>
          </span>
        </span>
      ),
    },
    { key: 'role', title: 'Role', sortable: true },
    {
      key: 'status',
      title: 'Status',
      render: (_value: unknown, row: Record<string, unknown>) => (
        <IrisBadge tone={tone((row as unknown as User).status)} variant="subtle">
          {(row as unknown as User).status}
        </IrisBadge>
      ),
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            title: 'Actions',
            render: (_value: unknown, row: Record<string, unknown>) => (
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <IrisButton
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(row as unknown as User)}
                >
                  Edit
                </IrisButton>
                <IrisButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(row as unknown as User)}
                >
                  Delete
                </IrisButton>
              </span>
            ),
          } as IrisTableColumn,
        ]
      : []),
  ]

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

      <IrisTable
        rowKey="id"
        columns={columns}
        data={users.state.rows as any}
        selectable="multi"
        selection={users.state.selectedKeys}
        onSelectionChange={(next) => {
          users.selection.clear()
          for (const k of next) users.selection.select(String(k))
        }}
        sort={users.state.sort as IrisTableSortState | null}
        onSortChange={(next) => users.setSort(next)}
        striped
        bordered
      />

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
