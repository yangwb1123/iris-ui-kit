<script lang="ts">
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
    type IrisTableSortState,
    useToast,
    type IrisSelectItem,
  } from '@iris-ui-kit/svelte'
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
  const statusItems: IrisSelectItem<UserStatus>[] = USER_STATUSES.map((s) => ({
    value: s,
    label: s,
  }))

  const tone = (s: UserStatus): 'success' | 'warning' | 'danger' =>
    s === 'active' ? 'success' : s === 'invited' ? 'warning' : 'danger'

  const emptyDraft: UserDraft = { name: '', email: '', role: 'Viewer', status: 'invited' }

  // The flagship CRUD resource. List + sort + filter + pagination + selection
  // come from `useResourceController` over `createClientFetcher` (the same
  // framework-agnostic engine the React/Vue/Solid demos use). Create / Edit go
  // through a Drawer form; Delete confirms in a Dialog; a bulk delete acts on
  // the selection — all routed through `controller.mutate` (optimistic for
  // deletes, with toasts on success / failure). The shared repository persists
  // changes across reloads.
  const { session } = useAuth()
  const canWrite = $derived($session?.role === 'admin')
  const toast = useToast()

  const users = useResourceController<User>({ fetcher: fetchUsers, pageSize: 6 })
  // `$state` is a Svelte rune, so alias the readable state store (see Dropdown.svelte).
  const view = users.state

  let draft = $state<UserDraft>({ ...emptyDraft })
  let editingId = $state<number | null>(null)
  let drawerOpen = $state(false)
  let confirmDelete = $state<User | null>(null)
  let confirmBulk = $state(false)

  const selectedIds = $derived($view.selectedKeys.map(Number))

  function onSelectionChange(next: Array<string | number>) {
    users.selection.clear()
    for (const k of next) users.selection.select(String(k))
  }

  function openCreate() {
    editingId = null
    draft = { ...emptyDraft }
    drawerOpen = true
  }
  function openEdit(u: User) {
    editingId = u.id
    draft = { name: u.name, email: u.email, role: u.role, status: u.status }
    drawerOpen = true
  }

  async function saveDraft() {
    if (!draft.name.trim() || !draft.email.trim()) {
      toast.warning({ title: 'Name and email are required' })
      return
    }
    const isEdit = editingId !== null
    const id = editingId
    const snapshot = { ...draft }
    drawerOpen = false
    try {
      // Plain action-then-reload: the row id is assigned by the store on create,
      // so we reload to render the canonical row rather than an optimistic guess.
      await users.mutate(async () => {
        if (isEdit) updateUser(id!, snapshot)
        else createUser(snapshot)
      })
      toast.success({ title: isEdit ? 'User updated' : 'User created', description: snapshot.name })
    } catch {
      toast.error({ title: 'Save failed', description: 'Your change was rolled back.' })
    }
  }

  async function doDelete(u: User) {
    confirmDelete = null
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

  async function doBulkDelete() {
    const ids = [...selectedIds]
    confirmBulk = false
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
</script>

<section>
  <div
    style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap"
  >
    <div>
      <h1 class="page-title">All users</h1>
      <p class="page-desc" style="margin-bottom: 12px">
        Real CRUD on a shared local-first repository via <code>createResourceController</code> +
        <code>createClientFetcher</code> — sort, filter, paginate, select, and
        <code>mutate</code> (optimistic deletes), all from @iris-ui-kit/core.{#if $view.selectedKeys.length > 0}
          · {$view.selectedKeys.length} selected{/if}
      </p>
    </div>
    <div style="display: flex; gap: 8px">
      {#if selectedIds.length > 0 && canWrite}
        <IrisButton variant="outline" onclick={() => (confirmBulk = true)}>
          <IrisIcon name="x" size={16} /> Delete {selectedIds.length}
        </IrisButton>
      {/if}
      {#if canWrite}
        <IrisButton variant="solid" onclick={openCreate}>
          <IrisIcon name="plus" size={16} /> New user
        </IrisButton>
      {/if}
    </div>
  </div>

  <div style="max-width: 280px; margin-bottom: 12px">
    <IrisInput
      value={$view.filters.name ?? ''}
      oninput={(e) => users.setFilter('name', e.currentTarget.value)}
      placeholder="Filter by name…"
      aria-label="Filter users by name"
    />
  </div>

  {#snippet userCell(row: Record<string, unknown>)}
    <span class="cms-user">
      <IrisAvatar name={(row as unknown as User).name} size={32} />
      <span>
        <div style="font-weight: 600">{(row as unknown as User).name}</div>
        <div style="color: var(--iris-muted); font-size: var(--iris-font-size-xs, 12px)">
          {(row as unknown as User).email}
        </div>
      </span>
    </span>
  {/snippet}
  {#snippet statusCell(row: Record<string, unknown>)}
    <IrisBadge tone={tone((row as unknown as User).status)} variant="subtle">
      {(row as unknown as User).status}
    </IrisBadge>
  {/snippet}
  {#snippet actionsCell(row: Record<string, unknown>)}
    <span style="display: inline-flex; gap: var(--iris-space-xs, 8px)">
      <IrisButton size="sm" variant="ghost" onclick={() => openEdit(row as unknown as User)}
        >Edit</IrisButton
      >
      <IrisButton
        size="sm"
        variant="ghost"
        onclick={() => (confirmDelete = row as unknown as User)}
      >
        Delete
      </IrisButton>
    </span>
  {/snippet}

  <IrisTable
    columns={[
      {
        key: 'name',
        title: 'User',
        sortable: true,
        render: (_v: unknown, row: Record<string, unknown>) => userCell(row),
      },
      { key: 'role', title: 'Role', sortable: true },
      {
        key: 'status',
        title: 'Status',
        render: (_v: unknown, row: Record<string, unknown>) => statusCell(row),
      },
      ...(canWrite
        ? [
            {
              key: 'actions',
              title: 'Actions',
              align: 'right' as const,
              render: (_v: unknown, row: Record<string, unknown>) => actionsCell(row),
            },
          ]
        : []),
    ]}
    data={$view.rows as unknown as Record<string, unknown>[]}
    rowKey="id"
    selectable="multi"
    selection={$view.selectedKeys}
    onselectionchange={onSelectionChange}
    sort={$view.sort as IrisTableSortState | null}
    onsortchange={(next: IrisTableSortState | null) => users.setSort(next)}
    striped
  ></IrisTable>

  <div style="margin-top: 16px">
    <IrisPagination
      value={$view.page}
      total={$view.total}
      pageSize={$view.pageSize}
      onchange={(p) => users.setPage(p)}
    />
  </div>

  <!-- Create / Edit drawer with a form. -->
  <IrisDrawer open={drawerOpen} onOpenChange={(o) => (drawerOpen = o)} side="right" size="380px">
    <IrisDrawerContent>
      <IrisDrawerTitle>{editingId !== null ? 'Edit user' : 'New user'}</IrisDrawerTitle>
      <div style="padding: 16px">
        <IrisStack spacing={16}>
          <IrisFormField label="Name" required>
            <IrisInput
              value={draft.name}
              oninput={(e) => (draft.name = e.currentTarget.value)}
              aria-label="Name"
            />
          </IrisFormField>
          <IrisFormField label="Email" required>
            <IrisInput
              type="email"
              value={draft.email}
              oninput={(e) => (draft.email = e.currentTarget.value)}
              aria-label="Email"
            />
          </IrisFormField>
          <IrisFormField label="Role">
            <IrisSelect
              items={roleItems}
              value={draft.role}
              onValueChange={(role) => (draft.role = role as UserRole)}
              style="width: 100%"
            />
          </IrisFormField>
          <IrisFormField label="Status">
            <IrisSelect
              items={statusItems}
              value={draft.status}
              onValueChange={(status) => (draft.status = status as UserStatus)}
              style="width: 100%"
            />
          </IrisFormField>
          <div style="display: flex; gap: 8px; justify-content: flex-end">
            <IrisButton variant="ghost" onclick={() => (drawerOpen = false)}>Cancel</IrisButton>
            <IrisButton variant="solid" onclick={saveDraft}>
              {editingId !== null ? 'Save changes' : 'Create user'}
            </IrisButton>
          </div>
        </IrisStack>
      </div>
    </IrisDrawerContent>
  </IrisDrawer>

  <!-- Delete confirmation. -->
  <IrisDialog open={confirmDelete !== null} onOpenChange={(o) => !o && (confirmDelete = null)}>
    <IrisDialogContent>
      <IrisDialogTitle>Delete user?</IrisDialogTitle>
      <IrisDialogDescription>
        {confirmDelete ? `“${confirmDelete.name}” will be removed. This can't be undone.` : ''}
      </IrisDialogDescription>
      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px">
        <IrisButton variant="ghost" onclick={() => (confirmDelete = null)}>Cancel</IrisButton>
        <IrisButton variant="solid" onclick={() => confirmDelete && doDelete(confirmDelete)}>
          Delete
        </IrisButton>
      </div>
    </IrisDialogContent>
  </IrisDialog>

  <!-- Bulk delete confirmation. -->
  <IrisDialog open={confirmBulk} onOpenChange={(o) => (confirmBulk = o)}>
    <IrisDialogContent>
      <IrisDialogTitle>Delete {selectedIds.length} users?</IrisDialogTitle>
      <IrisDialogDescription>
        The selected users will be removed. This can't be undone.
      </IrisDialogDescription>
      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px">
        <IrisButton variant="ghost" onclick={() => (confirmBulk = false)}>Cancel</IrisButton>
        <IrisButton variant="solid" onclick={doBulkDelete}>Delete selected</IrisButton>
      </div>
    </IrisDialogContent>
  </IrisDialog>
</section>
