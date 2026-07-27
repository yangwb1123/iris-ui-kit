<script lang="ts">
  import IrisDashboard from './IrisDashboard.svelte'
  import type { DashboardConfig } from '../core'

  let { config, onOpen }: { config: DashboardConfig; onOpen: () => void } = $props()
</script>

<IrisDashboard {config}>
  {#snippet renderWidget({ contentKey })}
    <button type="button" data-sales onclick={onOpen}>Open {contentKey}</button>
  {/snippet}
</IrisDashboard>
