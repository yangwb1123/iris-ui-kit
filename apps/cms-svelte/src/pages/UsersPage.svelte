<script lang="ts">
  import {
    IrisAvatar,
    IrisBadge,
    IrisCheckbox,
    IrisInput,
    IrisPagination,
    createClientFetcher,
    useResourceController,
    type DataViewColumn,
  } from '@iris-ui/svelte'

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

  // A real CRUD list driven entirely by the framework-agnostic
  // `createResourceController` (via the `useResourceController` bridge) in client
  // mode (`createClientFetcher`): keyword filter + sortable columns + pagination +
  // the composed selection model, rendered with Iris primitives.
  const users = useResourceController<User>({ fetcher: fetchUsers, pageSize: 4 })
  // `$state` is a Svelte rune, so alias the readable state store (see Dropdown.svelte).
  const view = users.state

  const pageIds = $derived($view.rows.map((u) => String(u.id)))
  const allOnPage = $derived(
    pageIds.length > 0 && pageIds.every((id) => $view.selectedKeys.includes(id)),
  )

  const ariaSort = (key: string): 'ascending' | 'descending' | 'none' =>
    $view.sort?.key === key ? ($view.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
  const sortGlyph = (key: string) =>
    $view.sort?.key === key ? ($view.sort.direction === 'asc' ? ' ▲' : ' ▼') : ''

  function toggleSort(key: string) {
    users.setSort(nextSort($view.sort, key))
  }
  function onHeaderKey(e: KeyboardEvent, key: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleSort(key)
    }
  }
</script>

<section>
  <h1 class="page-title">All users</h1>
  <p class="page-desc">
    Driven by <code>createResourceController</code> in client mode (<code>createClientFetcher</code
    >) — keyword filter + sortable columns + pagination + selection, all from @iris-ui/core.{#if $view.selectedKeys.length > 0}
      · {$view.selectedKeys.length} selected{/if}
  </p>
  <div style="max-width: 260px; margin-bottom: 12px">
    <IrisInput
      value={$view.filters.name ?? ''}
      oninput={(e) => users.setFilter('name', e.currentTarget.value)}
      placeholder="Filter by name…"
      aria-label="Filter users by name"
    />
  </div>
  <table class="cms-table">
    <thead>
      <tr>
        <th style="width: 36px">
          <IrisCheckbox
            value={allOnPage}
            onchange={() => users.selection.toggleAll(pageIds)}
            aria-label="Select all on page"
          />
        </th>
        <th
          scope="col"
          aria-sort={ariaSort('name')}
          tabindex={0}
          style="cursor: pointer"
          onclick={() => toggleSort('name')}
          onkeydown={(e) => onHeaderKey(e, 'name')}
        >
          User<span aria-hidden="true">{sortGlyph('name')}</span>
        </th>
        <th
          scope="col"
          aria-sort={ariaSort('role')}
          tabindex={0}
          style="cursor: pointer"
          onclick={() => toggleSort('role')}
          onkeydown={(e) => onHeaderKey(e, 'role')}
        >
          Role<span aria-hidden="true">{sortGlyph('role')}</span>
        </th>
        <th scope="col">Status</th>
      </tr>
    </thead>
    <tbody>
      {#each $view.rows as u (u.id)}
        <tr>
          <td>
            <IrisCheckbox
              value={$view.selectedKeys.includes(String(u.id))}
              onchange={() => users.selection.toggle(String(u.id))}
              aria-label={`Select ${u.name}`}
            />
          </td>
          <td>
            <span class="cms-user">
              <IrisAvatar name={u.name} size={32} />
              <span>
                <div style="font-weight: 600">{u.name}</div>
                <div style="color: var(--iris-muted); font-size: 12px">{u.email}</div>
              </span>
            </span>
          </td>
          <td>{u.role}</td>
          <td>
            <IrisBadge tone={tone(u.status)} variant="subtle">{u.status}</IrisBadge>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div style="margin-top: 16px">
    <IrisPagination
      value={$view.page}
      total={$view.total}
      pageSize={$view.pageSize}
      onchange={(p) => users.setPage(p)}
    />
  </div>
</section>
