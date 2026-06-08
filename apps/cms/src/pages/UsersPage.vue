<script setup lang="ts">
import { computed } from 'vue'
import {
  IrisAvatar,
  IrisBadge,
  IrisCheckbox,
  IrisInput,
  IrisPagination,
  createClientFetcher,
  useResourceController,
  type DataViewColumn,
} from '@iris-ui/vue'

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

const tone = (s: Status) => (s === 'active' ? 'success' : s === 'invited' ? 'warning' : 'danger')

/** Tri-state header sort cycle: none → asc → desc → none. */
type Sort = { key: string; direction: 'asc' | 'desc' } | null
function nextSort(current: Sort, key: string): Sort {
  if (!current || current.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
}

// A real CRUD list driven entirely by the framework-agnostic
// `createResourceController` (via the `useResourceController` bridge) in client
// mode (`createClientFetcher`): keyword filter + sortable columns + pagination +
// the composed selection model, rendered with Iris primitives.
const { state, selection, setPage, setSort, setFilter } = useResourceController<User>({
  fetcher: fetchUsers,
  pageSize: 4,
})
const pageIds = computed(() => state.value.rows.map((u) => String(u.id)))
const allOnPage = computed(
  () => pageIds.value.length > 0 && pageIds.value.every((id) => selection.isSelected(id)),
)

const ariaSort = (key: string): 'ascending' | 'descending' | 'none' =>
  state.value.sort?.key === key
    ? state.value.sort.direction === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none'
const sortGlyph = (key: string) =>
  state.value.sort?.key === key ? (state.value.sort.direction === 'asc' ? ' ▲' : ' ▼') : ''
</script>

<template>
  <section>
    <h1 class="page-title">All users</h1>
    <p class="page-desc">
      Driven by <code>createResourceController</code> in client mode
      (<code>createClientFetcher</code>) — keyword filter + sortable columns + pagination +
      selection, all from @iris-ui/core.
      <template v-if="state.selectedKeys.length > 0">
        · {{ state.selectedKeys.length }} selected</template
      >
    </p>
    <div style="max-width: 260px; margin-bottom: 12px">
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
  </section>
</template>
