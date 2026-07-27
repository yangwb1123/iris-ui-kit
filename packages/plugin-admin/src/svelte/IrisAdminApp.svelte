<script lang="ts">
  import type { Snippet } from 'svelte'
  import { IrisAdminLayout } from '@iris-ui-kit/svelte'
  import {
    firstNavLeafKey,
    normalizeAdminSchema,
    resolveAdminPage,
    type AdminActionHandler,
    type AdminAppSchema,
    type AdminMessages,
  } from '@iris-ui-kit/plugin-admin/core'
  import DataPage from './DataPage.svelte'

  let {
    schema,
    permissions = [],
    messages,
    onAction,
    renderPage,
  }: {
    schema: AdminAppSchema
    permissions?: readonly string[]
    messages?: AdminMessages
    onAction?: AdminActionHandler
    /** Render a custom page by key (for pages of type `'custom'`). */
    renderPage?: Snippet<[string]>
  } = $props()

  const normalized = $derived(normalizeAdminSchema(schema))
</script>

<IrisAdminLayout
  menus={normalized.nav}
  defaultActiveKey={firstNavLeafKey(normalized.nav)}
  appTitle={normalized.title}
>
  {#snippet children({ activeKey })}
    {@const page = resolveAdminPage(normalized, activeKey)}
    {#if page?.type === 'data'}
      {#key page.key}
        <DataPage {page} {permissions} {messages} {onAction} />
      {/key}
    {:else if page?.type === 'custom'}
      {@render renderPage?.(activeKey)}
    {:else}
      <div data-iris-admin-empty="">No page configured for "{activeKey}"</div>
    {/if}
  {/snippet}
</IrisAdminLayout>
