<script lang="ts">
  // Test fixture: drives IrisSidebarLayout with a render-prop sidebar Snippet.
  import IrisSidebarLayout from './SidebarLayout.svelte'

  let {
    collapsed,
    defaultCollapsed,
    onCollapsedChange,
  }: {
    collapsed?: boolean
    defaultCollapsed?: boolean
    onCollapsedChange?: (next: boolean) => void
  } = $props()
</script>

<IrisSidebarLayout {collapsed} {defaultCollapsed} {onCollapsedChange}>
  {#snippet sidebar(s)}
    <button data-toggle onclick={() => s.setCollapsed(!s.collapsed)}>
      {s.collapsed ? 'expand' : 'collapse'}
    </button>
  {/snippet}
  <div data-main>content</div>
</IrisSidebarLayout>
