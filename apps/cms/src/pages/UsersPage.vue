<script setup lang="ts">
import { computed, ref } from 'vue'
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
  type IrisListItem,
} from '@iris-ui-kit/vue'
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
import { authStore } from '../auth'

const roleItems: IrisListItem<UserRole>[] = USER_ROLES.map((r) => ({ value: r, label: r }))
const statusItems: IrisListItem<UserStatus>[] = USER_STATUSES.map((s) => ({ value: s, label: s }))

const tone = (s: UserStatus): 'success' | 'warning' | 'danger' =>
  s === 'active' ? 'success' : s === 'invited' ? 'warning' : 'danger'

/** Tri-state header sort cycle: none → asc → desc → none. */
type Sort = { key: string; direction: 'asc' | 'desc' } | null
function nextSort(current: Sort, key: string): Sort {
  if (!current || current.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
}

const emptyDraft = (): UserDraft => ({ name: '', email: '', role: 'Viewer', status: 'invited' })

// Admin-only write access drives the RBAC affordances (New / Edit / Delete).
const canWrite = computed(() => authStore.getState()?.session?.role === 'admin')
const toast = useToast()

// A real CRUD list driven entirely by the framework-agnostic
// `createResourceController` (via `useResourceController`) in client mode
// (`createClientFetcher`): keyword filter + sortable columns + pagination + the
// composed selection model. Create / Edit go through a Drawer form; Delete
// confirms in a Dialog; a bulk delete acts on the selection — all routed through
// `controller.mutate` (optimistic for deletes, with toasts on success/failure).
const controller = useResourceController<User>({ fetcher: fetchUsers, pageSize: 6 })
const { state, selection, setPage, setSort, setFilter, mutate } = controller

const pageIds = computed(() => state.value.rows.map((u) => String(u.id)))
const allOnPage = computed(
  () => pageIds.value.length > 0 && pageIds.value.every((id) => selection.isSelected(id)),
)
const selectedIds = computed(() => state.value.selectedKeys.map(Number))

const ariaSort = (key: string): 'ascending' | 'descending' | 'none' =>
  state.value.sort?.key === key
    ? state.value.sort.direction === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none'
const sortGlyph = (key: string) =>
  state.value.sort?.key === key ? (state.value.sort.direction === 'asc' ? ' ▲' : ' ▼') : ''

// ── Drawer form + confirmation state ─────────────────────────────────────────
const draft = ref<UserDraft>(emptyDraft())
const editingId = ref<number | null>(null)
const drawerOpen = ref(false)
const confirmDelete = ref<User | null>(null)
const confirmBulk = ref(false)

function openCreate() {
  editingId.value = null
  draft.value = emptyDraft()
  drawerOpen.value = true
}
function openEdit(u: User) {
  editingId.value = u.id
  draft.value = { name: u.name, email: u.email, role: u.role, status: u.status }
  drawerOpen.value = true
}

async function saveDraft() {
  const d = draft.value
  if (!d.name.trim() || !d.email.trim()) {
    toast.warning({ title: 'Name and email are required' })
    return
  }
  const isEdit = editingId.value !== null
  drawerOpen.value = false
  try {
    // Plain action-then-reload: the row id is assigned by the store on create,
    // so we reload to render the canonical row rather than an optimistic guess.
    await mutate(async () => {
      if (isEdit) updateUser(editingId.value!, d)
      else createUser(d)
    })
    toast.success({ title: isEdit ? 'User updated' : 'User created', description: d.name })
  } catch {
    toast.error({ title: 'Save failed', description: 'Your change was rolled back.' })
  }
}

async function doDelete(u: User) {
  confirmDelete.value = null
  try {
    // Optimistic: drop the row immediately; the controller rolls back if the
    // action rejects.
    await mutate(
      async () => {
        removeUser(u.id)
      },
      { optimistic: (rows) => rows.filter((r) => r.id !== u.id) },
    )
    selection.deselect(String(u.id))
    toast.success({ title: 'User deleted', description: u.name })
  } catch {
    toast.error({ title: 'Delete failed', description: 'The user was restored.' })
  }
}

async function doBulkDelete() {
  const ids = [...selectedIds.value]
  confirmBulk.value = false
  try {
    await mutate(
      async () => {
        removeUsers(ids)
      },
      { optimistic: (rows) => rows.filter((r) => !ids.includes(r.id)) },
    )
    selection.clear()
    toast.success({ title: `${ids.length} user${ids.length === 1 ? '' : 's'} deleted` })
  } catch {
    toast.error({ title: 'Bulk delete failed', description: 'Selection was restored.' })
  }
}
</script>

<template>
  <section>
    <div
      style="
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      "
    >
      <div>
        <h1 class="page-title">All users</h1>
        <p class="page-desc" style="margin-bottom: 12px">
          Real CRUD on a live in-memory store via <code>createResourceController</code> +
          <code>createClientFetcher</code> — sort, filter, paginate, select, and
          <code>mutate</code> (optimistic deletes), all from @iris-ui-kit/core.
          <template v-if="state.selectedKeys.length > 0">
            · {{ state.selectedKeys.length }} selected</template
          >
        </p>
      </div>
      <div style="display: flex; gap: 8px">
        <IrisButton
          v-if="selectedIds.length > 0 && canWrite"
          variant="outline"
          @click="confirmBulk = true"
        >
          <IrisIcon name="x" :size="16" /> Delete {{ selectedIds.length }}
        </IrisButton>
        <IrisButton v-if="canWrite" variant="solid" @click="openCreate">
          <IrisIcon name="plus" :size="16" /> New user
        </IrisButton>
      </div>
    </div>

    <div style="max-width: 280px; margin-bottom: 12px">
      <IrisInput
        :model-value="state.filters.name ?? ''"
        placeholder="Filter by name…"
        aria-label="Filter users by name"
        @update:model-value="setFilter('name', $event)"
      />
    </div>

    <table class="cms-table">
      <thead>
        <tr>
          <th style="width: 36px">
            <IrisCheckbox
              :model-value="allOnPage"
              aria-label="Select all on page"
              @update:model-value="selection.toggleAll(pageIds)"
            />
          </th>
          <th
            scope="col"
            :aria-sort="ariaSort('name')"
            :tabindex="0"
            style="cursor: pointer"
            @click="setSort(nextSort(state.sort, 'name'))"
            @keydown.enter.prevent="setSort(nextSort(state.sort, 'name'))"
            @keydown.space.prevent="setSort(nextSort(state.sort, 'name'))"
          >
            User<span aria-hidden="true">{{ sortGlyph('name') }}</span>
          </th>
          <th
            scope="col"
            :aria-sort="ariaSort('role')"
            :tabindex="0"
            style="cursor: pointer"
            @click="setSort(nextSort(state.sort, 'role'))"
            @keydown.enter.prevent="setSort(nextSort(state.sort, 'role'))"
            @keydown.space.prevent="setSort(nextSort(state.sort, 'role'))"
          >
            Role<span aria-hidden="true">{{ sortGlyph('role') }}</span>
          </th>
          <th scope="col">Status</th>
          <th v-if="canWrite" scope="col" style="width: 120px; text-align: end">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in state.rows" :key="u.id">
          <td>
            <IrisCheckbox
              :model-value="selection.isSelected(String(u.id))"
              :aria-label="`Select ${u.name}`"
              @update:model-value="selection.toggle(String(u.id))"
            />
          </td>
          <td>
            <span class="cms-user">
              <IrisAvatar :name="u.name" :size="32" />
              <span>
                <div style="font-weight: 600">{{ u.name }}</div>
                <div style="color: var(--iris-muted); font-size: 12px">{{ u.email }}</div>
              </span>
            </span>
          </td>
          <td>{{ u.role }}</td>
          <td>
            <IrisBadge :tone="tone(u.status)" variant="subtle">{{ u.status }}</IrisBadge>
          </td>
          <td v-if="canWrite" style="text-align: end">
            <span style="display: inline-flex; gap: 6px">
              <IrisButton size="sm" variant="ghost" @click="openEdit(u)">Edit</IrisButton>
              <IrisButton size="sm" variant="ghost" @click="confirmDelete = u">Delete</IrisButton>
            </span>
          </td>
        </tr>
        <tr v-if="state.rows.length === 0">
          <td :colspan="canWrite ? 5 : 4" style="color: var(--iris-muted); padding: 24px">
            No users match the current filter.
          </td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 16px">
      <IrisPagination
        :model-value="state.page"
        :total="state.total"
        :page-size="state.pageSize"
        @update:model-value="setPage"
      />
    </div>

    <!-- Create / Edit drawer with a form. -->
    <IrisDrawer v-model:open="drawerOpen" side="right" size="380px">
      <IrisDrawerContent>
        <IrisDrawerTitle>{{ editingId !== null ? 'Edit user' : 'New user' }}</IrisDrawerTitle>
        <div style="padding: 16px">
          <IrisStack :spacing="16">
            <IrisFormField label="Name" required>
              <IrisInput v-model="draft.name" aria-label="Name" />
            </IrisFormField>
            <IrisFormField label="Email" required>
              <IrisInput v-model="draft.email" type="email" aria-label="Email" />
            </IrisFormField>
            <IrisFormField label="Role">
              <IrisSelect
                :items="roleItems"
                :model-value="draft.role"
                style="width: 100%"
                @update:model-value="(v: unknown) => (draft.role = v as UserRole)"
              />
            </IrisFormField>
            <IrisFormField label="Status">
              <IrisSelect
                :items="statusItems"
                :model-value="draft.status"
                style="width: 100%"
                @update:model-value="(v: unknown) => (draft.status = v as UserStatus)"
              />
            </IrisFormField>
            <div style="display: flex; gap: 8px; justify-content: flex-end">
              <IrisButton variant="ghost" @click="drawerOpen = false">Cancel</IrisButton>
              <IrisButton variant="solid" @click="saveDraft">
                {{ editingId !== null ? 'Save changes' : 'Create user' }}
              </IrisButton>
            </div>
          </IrisStack>
        </div>
      </IrisDrawerContent>
    </IrisDrawer>

    <!-- Delete confirmation. -->
    <IrisDialog
      :open="confirmDelete !== null"
      @update:open="(o: boolean) => !o && (confirmDelete = null)"
    >
      <IrisDialogContent>
        <IrisDialogTitle>Delete user?</IrisDialogTitle>
        <IrisDialogDescription>
          {{
            confirmDelete ? `“${confirmDelete.name}” will be removed. This can't be undone.` : ''
          }}
        </IrisDialogDescription>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px">
          <IrisButton variant="ghost" @click="confirmDelete = null">Cancel</IrisButton>
          <IrisButton variant="solid" @click="confirmDelete && doDelete(confirmDelete)">
            Delete
          </IrisButton>
        </div>
      </IrisDialogContent>
    </IrisDialog>

    <!-- Bulk delete confirmation. -->
    <IrisDialog v-model:open="confirmBulk">
      <IrisDialogContent>
        <IrisDialogTitle>Delete {{ selectedIds.length }} users?</IrisDialogTitle>
        <IrisDialogDescription>
          The selected users will be removed. This can't be undone.
        </IrisDialogDescription>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px">
          <IrisButton variant="ghost" @click="confirmBulk = false">Cancel</IrisButton>
          <IrisButton variant="solid" @click="doBulkDelete">Delete selected</IrisButton>
        </div>
      </IrisDialogContent>
    </IrisDialog>
  </section>
</template>
