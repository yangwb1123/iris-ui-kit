<script lang="ts">
  import type { Snippet } from 'svelte'
  import IrisSidebarLayout from '../layouts/SidebarLayout.svelte'
  import IrisHeaderLayout from '../layouts/HeaderLayout.svelte'
  import IrisDashboardGrid from '../layouts/DashboardGrid.svelte'
  import IrisDashboardCard from '../layouts/DashboardCard.svelte'

  export interface IrisDashboardNavItem {
    id: string
    label: string
    icon?: string
  }

  export interface IrisDashboardCardSpec {
    id: string
    title: string
    colSpan?: number | 'full'
    rowSpan?: number
    body?: string
  }

  interface Props {
    title?: string
    sidebarTitle?: string
    nav?: IrisDashboardNavItem[]
    activeId?: string
    cards?: IrisDashboardCardSpec[]
    defaultCollapsed?: boolean
    onActiveIdChange?: (id: string) => void
    onCollapsedChange?: (collapsed: boolean) => void
    children?: Snippet
    style?: string
    class?: string
  }

  let {
    title = 'Dashboard',
    sidebarTitle = '',
    nav = [],
    activeId = '',
    cards = [],
    defaultCollapsed = false,
    onActiveIdChange,
    onCollapsedChange,
    children,
    style,
    class: className,
    ...rest
  }: Props = $props()

  // svelte-ignore state_referenced_locally
  let collapsed = $state(defaultCollapsed)

  function setCollapsed(v: boolean) {
    collapsed = v
    onCollapsedChange?.(v)
  }
</script>

{#snippet sidebarContent()}
  <div style:padding="16px">
    {#if sidebarTitle}
      <div
        style:font-weight="700"
        style:font-size="14px"
        style:margin-bottom="12px"
        style:color="var(--iris-foreground)"
      >
        {sidebarTitle}
      </div>
    {/if}
    <nav>
      {#each nav as item (item.id)}
        <button
          type="button"
          data-iris-dashboard-nav-item
          data-state={item.id === activeId ? 'active' : 'idle'}
          onclick={() => onActiveIdChange?.(item.id)}
          style:display="flex"
          style:align-items="center"
          style:gap="8px"
          style:width="100%"
          style:padding="8px 12px"
          style:border="none"
          style:border-radius="var(--iris-radius-sm, 4px)"
          style:background={item.id === activeId ? 'var(--iris-surface-hover)' : 'transparent'}
          style:color="var(--iris-foreground)"
          style:cursor="pointer"
          style:font-size="14px"
          style:font-family="inherit"
          style:text-align="start"
        >
          {#if item.icon}<span aria-hidden="true">{item.icon}</span>{/if}
          {item.label}
        </button>
      {/each}
    </nav>
  </div>
{/snippet}

{#snippet headerContent()}
  <div style:padding="0 16px" style:font-weight="700" style:font-size="16px">{title}</div>
{/snippet}

{#snippet mainContent()}
  <div style:padding="24px" style:overflow-y="auto" style:flex="1">
    {#if cards.length > 0}
      <IrisDashboardGrid>
        {#each cards as card (card.id)}
          <IrisDashboardCard title={card.title} colSpan={card.colSpan} rowSpan={card.rowSpan}>
            {#if card.body}
              <p style:margin="0" style:font-size="14px" style:color="var(--iris-muted)">
                {card.body}
              </p>
            {/if}
          </IrisDashboardCard>
        {/each}
      </IrisDashboardGrid>
    {/if}
    {@render children?.()}
  </div>
{/snippet}

<div
  data-iris-dashboard-template
  style:width="100%"
  style:height="100vh"
  style:display="flex"
  style:flex-direction="column"
  style:overflow="hidden"
  {style}
  class={className}
  {...rest}
>
  <IrisSidebarLayout
    {collapsed}
    onCollapsedChange={setCollapsed}
    sidebar={sidebarContent}
    style="flex: 1; overflow: hidden; min-height: 0;"
  >
    <IrisHeaderLayout header={headerContent}>
      {@render mainContent()}
    </IrisHeaderLayout>
  </IrisSidebarLayout>
</div>
