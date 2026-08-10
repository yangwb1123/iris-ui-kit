<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { IrisButton, IrisInput, useI18n } from '@iris-ui-kit/svelte'
  import {
    adminFieldName,
    createAdminDataController,
    formatAdminCell,
    hasAdminPermission,
    resolveAdminMessage,
    type AdminActionHandler,
    type AdminDataPage,
    type AdminMessageKey,
    type AdminMessages,
  } from '@iris-ui-kit/plugin-admin/core'
  import AdminField from './AdminField.svelte'

  let {
    page,
    permissions = [],
    messages,
    onAction,
  }: {
    page: AdminDataPage
    permissions?: readonly string[]
    messages?: AdminMessages
    onAction?: AdminActionHandler
  } = $props()

  // The parent keys this component by page key. `untrack` makes that intentional
  // mount-lifetime ownership explicit while the page's live state stays in core.
  const controller = untrack(() => createAdminDataController(page))
  let resource = $state(controller.resource.getState())
  let editor = $state(controller.editor.getState())
  const unsubscribeResource = controller.resource.subscribe((next) => (resource = next))
  const unsubscribeEditor = controller.editor.subscribe((next) => (editor = next))
  onDestroy(() => {
    unsubscribeResource()
    unsubscribeEditor()
    controller.destroy()
  })

  const i18n = useI18n()
  const canCreate = $derived(
    controller.capabilities.create && hasAdminPermission(page.permissions?.create, permissions),
  )
  const canUpdate = $derived(
    controller.capabilities.update && hasAdminPermission(page.permissions?.update, permissions),
  )
  const canDelete = $derived(
    controller.capabilities.delete && hasAdminPermission(page.permissions?.delete, permissions),
  )
  const actions = $derived(
    (page.actions ?? []).filter((action) => hasAdminPermission(action.permission, permissions)),
  )
  const showActions = $derived(canUpdate || canDelete || actions.length > 0)
  const pageCount = $derived.by(() => {
    void resource.total
    void resource.pageSize
    return Math.max(1, controller.resource.pageCount())
  })
  const failure = $derived(editor.actionError ?? resource.error)

  function message(key: AdminMessageKey, params: Record<string, string | number> = {}): string {
    return resolveAdminMessage(key, params, messages, i18n.t)
  }

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  function toggleSort(columnKey: string): void {
    const active = resource.sort?.key === columnKey ? resource.sort : null
    controller.resource.setSort(
      !active
        ? { key: columnKey, direction: 'asc' }
        : active.direction === 'asc'
          ? { key: columnKey, direction: 'desc' }
          : null,
    )
  }
</script>

<div
  data-iris-admin-data-page={page.key}
  style="display:flex;flex-direction:column;gap:var(--iris-admin-page-gap,var(--iris-gap-md))"
>
  <div style="display:flex;align-items:center;flex-wrap:wrap;gap:var(--iris-gap-sm)">
    {#if page.title}<h2 data-iris-admin-page-title="">{page.title}</h2>{/if}
    {#if canCreate}
      <IrisButton onclick={() => controller.beginCreate()}>{message('create')}</IrisButton>
    {/if}
  </div>

  {#if editor.mode !== 'idle'}
    <form
      data-iris-admin-editor={editor.mode}
      aria-label={message(editor.mode === 'create' ? 'editorCreate' : 'editorEdit', {
        title: page.title ?? page.key,
      })}
      style="display:flex;flex-direction:column;gap:var(--iris-gap-md)"
      onsubmit={(event) => {
        event.preventDefault()
        void controller.save()
      }}
    >
      {#each controller.editableColumns as column (column.key)}
        {@const field = adminFieldName(column)}
        <AdminField
          {column}
          id={`iris-admin-${page.key}-${field}`}
          value={editor.draft[field]}
          error={editor.errors[field]}
          onvalue={(value) => controller.setField(field, value)}
        />
      {/each}
      <div style="display:flex;align-items:center;gap:var(--iris-gap-sm)">
        <IrisButton type="submit" loading={editor.saving}>{message('save')}</IrisButton>
        <IrisButton variant="outline" onclick={() => controller.cancelEdit()}>
          {message('cancel')}
        </IrisButton>
      </div>
    </form>
  {/if}

  {#if failure}
    <div role="alert" data-iris-admin-error>
      {errorText(failure)}
      <IrisButton variant="outline" onclick={() => void controller.resource.reload()}>
        {message('retry')}
      </IrisButton>
    </div>
  {/if}
  {#if resource.loading}
    <div role="status" aria-live="polite">{message('loading')}</div>
  {/if}

  <table
    data-iris-admin-table
    aria-label={page.title ?? page.key}
    aria-busy={resource.loading || undefined}
  >
    <thead>
      <tr>
        {#each page.columns as column (column.key)}
          {@const activeSort = resource.sort?.key === column.key ? resource.sort : null}
          <th
            scope="col"
            aria-sort={activeSort
              ? activeSort.direction === 'asc'
                ? 'ascending'
                : 'descending'
              : undefined}
          >
            {#if column.sortable}
              <button type="button" onclick={() => toggleSort(column.key)}>{column.title}</button>
            {:else}
              {column.title}
            {/if}
          </th>
        {/each}
        {#if showActions}<th scope="col">{message('actions')}</th>{/if}
      </tr>
      {#if page.columns.some((column) => column.filterable)}
        <tr data-iris-admin-filters>
          {#each page.columns as column (column.key)}
            <th>
              {#if column.filterable}
                <IrisInput
                  type="search"
                  value={resource.filters[column.key] ?? ''}
                  aria-label={message('filter', { column: column.title })}
                  oninput={(event) =>
                    controller.resource.setFilter(column.key, event.currentTarget.value)}
                />
              {/if}
            </th>
          {/each}
          {#if showActions}<th></th>{/if}
        </tr>
      {/if}
    </thead>
    <tbody>
      {#if resource.rows.length === 0 && !resource.loading}
        <tr>
          <td colspan={page.columns.length + (showActions ? 1 : 0)}>{message('empty')}</td>
        </tr>
      {:else}
        {#each resource.rows as row, index (controller.rowKey(row, index))}
          {@const key = controller.rowKey(row, index)}
          {@const confirming = editor.deletingKey === key}
          <tr data-row-key={key}>
            {#each page.columns as column (column.key)}
              <td>{formatAdminCell(row[adminFieldName(column)], column)}</td>
            {/each}
            {#if showActions}
              <td>
                <div style="display:flex;align-items:center;flex-wrap:wrap;gap:var(--iris-gap-sm)">
                  {#if canUpdate}
                    <IrisButton variant="outline" onclick={() => controller.beginEdit(row)}>
                      {message('edit')}
                    </IrisButton>
                  {/if}
                  {#if canDelete && !confirming}
                    <IrisButton variant="outline" onclick={() => controller.requestDelete(row)}>
                      {message('delete')}
                    </IrisButton>
                  {:else if canDelete && confirming}
                    <IrisButton
                      loading={editor.saving}
                      onclick={() => void controller.confirmDelete()}
                    >
                      {message('confirmDelete')}
                    </IrisButton>
                    <IrisButton variant="outline" onclick={() => controller.cancelDelete()}>
                      {message('cancel')}
                    </IrisButton>
                  {/if}
                  {#each actions as action (action.key)}
                    <IrisButton
                      variant="outline"
                      loading={editor.runningAction === `${action.key}:${key}`}
                      disabled={!onAction}
                      onclick={() => void controller.runAction(action.key, row, onAction)}
                    >
                      {action.label}
                    </IrisButton>
                  {/each}
                </div>
              </td>
            {/if}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>

  <nav
    data-iris-admin-pager
    aria-label={`${page.title ?? page.key} pagination`}
    style="display:flex;align-items:center;gap:var(--iris-gap-sm)"
  >
    <IrisButton
      variant="outline"
      disabled={resource.page <= 1}
      onclick={() => controller.resource.setPage(resource.page - 1)}
    >
      {message('previous')}
    </IrisButton>
    <span data-iris-admin-page-info>
      {message('page', { page: resource.page, pages: pageCount })}
    </span>
    <IrisButton
      variant="outline"
      disabled={resource.page >= pageCount}
      onclick={() => controller.resource.setPage(resource.page + 1)}
    >
      {message('next')}
    </IrisButton>
  </nav>
</div>
