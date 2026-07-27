<script lang="ts">
  // Test host: drives IrisAdminApp with a `renderPage` snippet (the Svelte
  // analogue of React's `renderPage` render-prop) so the custom page can be
  // exercised from a `.test.ts` (snippets can't be passed as plain props).
  import IrisAdminApp from './IrisAdminApp.svelte'
  import type { AdminAppSchema } from '@iris-ui-kit/plugin-admin/core'

  let { schema }: { schema: AdminAppSchema } = $props()
</script>

<IrisAdminApp {schema}>
  {#snippet renderPage(key)}
    <div data-custom={key}>Custom {key}</div>
  {/snippet}
</IrisAdminApp>
