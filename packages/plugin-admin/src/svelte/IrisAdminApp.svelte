<script lang="ts">
  import type { Snippet } from 'svelte'
  import { IrisAdminLayout } from '@iris-ui/svelte'
  import { resolveAdminPage, firstNavLeafKey, type AdminAppSchema } from '../core'
  import DataPage from './DataPage.svelte'

  let {
    schema,
    renderPage,
  }: {
    schema: AdminAppSchema
    /** Render a custom page by key (for pages of type `'custom'`). */
    renderPage?: Snippet<[string]>
  } = $props()
</script>

<IrisAdminLayout
  menus={schema.nav}
  defaultActiveKey={firstNavLeafKey(schema.nav)}
  appTitle={schema.title}
>
  {#snippet children({ activeKey })}
    {@const page = resolveAdminPage(schema, activeKey)}
    {#if page?.type === 'data'}
      {#key page.key}
        <DataPage {page} />
      {/key}
    {:else if page?.type === 'custom'}
      {@render renderPage?.(activeKey)}
    {:else}
      <div data-iris-admin-empty="">No page configured for "{activeKey}"</div>
    {/if}
  {/snippet}
</IrisAdminLayout>
