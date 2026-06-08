<script lang="ts">
  import {
    IrisAvatar,
    IrisBadge,
    IrisCheckbox,
    IrisPagination,
    useResourceController,
  } from '@iris-ui/svelte'

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

  // L4 validation: a real CRUD list driven entirely by the framework-agnostic
  // `createResourceController` (via the `useResourceController` bridge) — server
  // pagination + the composed selection model, rendered with Iris primitives.
  const users = useResourceController<User>({ fetcher: fetchUsers, pageSize: 4 })
  // `$state` is a Svelte rune, so alias the readable state store (see Dropdown.svelte).
  const view = users.state

  const pageIds = $derived($view.rows.map((u) => String(u.id)))
  const allOnPage = $derived(
    pageIds.length > 0 && pageIds.every((id) => $view.selectedKeys.includes(id)),
  )
</script>

<section>
  <h1 class="page-title">All users</h1>
  <p class="page-desc">
    Driven by <code>createResourceController</code> (server pagination + selection) from
    @iris-ui/core — the L4 composite, rendered with Iris primitives.{#if $view.selectedKeys.length > 0}
      · {$view.selectedKeys.length} selected{/if}
  </p>
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
        <th>User</th>
        <th>Role</th>
        <th>Status</th>
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
