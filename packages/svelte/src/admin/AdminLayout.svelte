<script lang="ts">
  import type { NavNode } from '@iris-ui-kit/core'
  import IrisSidebarLayout from '../layouts/SidebarLayout.svelte'
  import IrisHeaderLayout from '../layouts/HeaderLayout.svelte'
  import type { IrisSidebarLayoutSidebarState } from '../layouts/types'
  import IrisNavMenu from './NavMenu.svelte'
  import IrisAdminBreadcrumb from './AdminBreadcrumb.svelte'
  import IrisAdminTabs from './AdminTabs.svelte'
  import IrisIcon from '../primitives/icon/IrisIcon.svelte'
  import { useI18n } from '../i18n'
  import { useAdminShell } from './useAdminShell.svelte'
  import type { IrisAdminLayoutProps } from './types'

  const { t } = useI18n()

  let {
    menus,
    activeKey,
    defaultActiveKey,
    onActiveKeyChange,
    collapsed,
    defaultCollapsed = false,
    onCollapsedChange,
    mode = 'sidebar',
    appTitle = 'Iris Admin',
    tabs,
    showTabs = true,
    showBreadcrumb = true,
    stickyHeader = true,
    stickyTabs = true,
    menuAlign = 'start',
    contentWidth = 'fluid',
    contentHeight = 'viewport',
    sidebarWidth = 240,
    collapsedWidth = 64,
    logo,
    toolbar,
    footer,
    onSelect,
    children,
  }: IrisAdminLayoutProps = $props()

  const shell = useAdminShell(() => ({
    menus,
    activeKey,
    defaultActiveKey,
    onActiveKeyChange,
    onSelect,
    tabs,
  }))
  const currentActive = $derived(shell.activeKey)
  const trail = $derived(shell.breadcrumb)
  function handleSelect(_key: string, node: NavNode): void {
    shell.navigate(node)
  }

  const collapseControlled = $derived(collapsed !== undefined)
  // svelte-ignore state_referenced_locally — initial seed; controlled reads use the prop.
  let internalCollapsed = $state(defaultCollapsed)
  const currentCollapsed = $derived(collapseControlled ? (collapsed as boolean) : internalCollapsed)
  function setCollapsed(next: boolean): void {
    if (!collapseControlled) internalCollapsed = next
    onCollapsedChange?.(next)
  }

  // Mirror tab-store activation (incl. close→neighbor) back into the active key.
  $effect(() => {
    const nav = tabs
    if (!nav) return
    return nav.store.subscribe((s) => {
      shell.syncFromTab(s.activeKey ?? '')
    })
  })
</script>

{#snippet defaultLogo(state: { collapsed: boolean })}
  <div
    data-iris-admin-logo
    style="display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 16px; color: var(--iris-foreground); font-weight: 700; font-size: 16px; white-space: nowrap; overflow: hidden; flex-shrink: 0"
  >
    <span
      style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--iris-radius-md, 6px); background: var(--iris-primary); color: var(--iris-primary-foreground, #fff); flex-shrink: 0"
    >
      <IrisIcon name="menu" size={18} />
    </span>
    {#if !state.collapsed}<span>{appTitle}</span>{/if}
  </div>
{/snippet}

{#snippet logoRegion(state: { collapsed: boolean })}
  {#if logo}{@render logo(state)}{:else}{@render defaultLogo(state)}{/if}
{/snippet}

{#snippet sidebarRegion(state: IrisSidebarLayoutSidebarState)}
  <div
    data-iris-admin-sidebar
    style="display: flex; flex-direction: column; height: 100%; border-inline-end: 1px solid var(--iris-border); background: var(--iris-surface)"
  >
    {@render logoRegion(state)}
    <div style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px">
      <IrisNavMenu
        items={menus}
        activeKey={currentActive}
        collapsed={state.collapsed}
        onSelect={handleSelect}
      />
    </div>
  </div>
{/snippet}

{#snippet headerBar()}
  <div
    data-iris-admin-headerbar
    style="display: flex; align-items: center; gap: 12px; height: 52px; padding: 0 16px; border-bottom: 1px solid var(--iris-border); background: var(--iris-background)"
  >
    <button
      type="button"
      data-iris-admin-collapse
      aria-label={currentCollapsed ? t('admin.expandSidebar') : t('admin.collapseSidebar')}
      aria-pressed={currentCollapsed ? 'true' : 'false'}
      style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; border-radius: var(--iris-radius-md, 6px); background: transparent; color: var(--iris-foreground); cursor: pointer; flex-shrink: 0"
      onclick={() => setCollapsed(!currentCollapsed)}
    >
      <IrisIcon name={currentCollapsed ? 'chevron-right' : 'menu'} size={18} />
    </button>
    {#if showBreadcrumb}<IrisAdminBreadcrumb {trail} onSelect={handleSelect} />{/if}
    <div style="flex: 1"></div>
    {#if toolbar}
      <div data-iris-admin-toolbar style="display: flex; align-items: center; gap: 8px">
        {@render toolbar()}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet headerRegion()}
  <div data-iris-admin-header>
    {@render headerBar()}
    {#if tabs && showTabs}
      <div
        data-iris-admin-tabs-region
        data-sticky={stickyTabs ? 'true' : undefined}
        style:position={stickyTabs && !stickyHeader ? 'sticky' : 'relative'}
        style:top="0"
        style:z-index="49"
      >
        <IrisAdminTabs nav={tabs} />
      </div>
    {/if}
  </div>
{/snippet}

{#snippet content()}
  {@render children?.({ activeKey: currentActive })}
{/snippet}

{#snippet contentRegion(horizontal = false)}
  <div
    data-iris-admin-content
    data-width={contentWidth}
    style:box-sizing="border-box"
    style:width="100%"
    style:max-width={contentWidth === 'centered' ? '72rem' : undefined}
    style:margin-inline={contentWidth === 'centered' ? 'auto' : undefined}
    style:padding="16px"
  >
    {#if horizontal && showBreadcrumb}
      <IrisAdminBreadcrumb {trail} onSelect={handleSelect} />
    {/if}
    {@render content()}
  </div>
{/snippet}

{#snippet horizontalHeader()}
  <div data-iris-admin-header>
    <div
      data-iris-admin-headerbar
      style="display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 16px; background: var(--iris-background)"
    >
      {@render logoRegion({ collapsed: false })}
      <div
        data-iris-admin-topnav
        style:display="flex"
        style:flex="1"
        style:min-width="0"
        style:justify-content={menuAlign === 'center'
          ? 'center'
          : menuAlign === 'end'
            ? 'flex-end'
            : 'flex-start'}
      >
        <IrisNavMenu
          items={menus}
          activeKey={currentActive}
          orientation="horizontal"
          onSelect={handleSelect}
        />
      </div>
      {#if toolbar}
        <div data-iris-admin-toolbar style="display: flex; align-items: center; gap: 8px">
          {@render toolbar()}
        </div>
      {/if}
    </div>
    {#if tabs && showTabs}
      <div
        data-iris-admin-tabs-region
        data-sticky={stickyTabs ? 'true' : undefined}
        style:position={stickyTabs && !stickyHeader ? 'sticky' : 'relative'}
        style:top="0"
        style:z-index="49"
      >
        <IrisAdminTabs nav={tabs} />
      </div>
    {/if}
  </div>
{/snippet}

{#if mode === 'full-content'}
  <div data-iris-admin-layout data-mode="full-content" style="height: 100%">
    {@render content()}
  </div>
{:else if mode === 'horizontal'}
  <div
    data-iris-admin-layout
    data-mode="horizontal"
    style:height={contentHeight === 'viewport' ? '100vh' : 'auto'}
    style:min-height="100vh"
  >
    <IrisHeaderLayout sticky={stickyHeader} header={horizontalHeader} {footer}>
      {@render contentRegion(true)}
    </IrisHeaderLayout>
  </div>
{:else}
  <IrisSidebarLayout
    data-iris-admin-layout
    data-mode="sidebar"
    collapsed={currentCollapsed}
    onCollapsedChange={setCollapsed}
    width={sidebarWidth}
    {collapsedWidth}
    style="height: 100vh"
    sidebar={sidebarRegion}
  >
    <IrisHeaderLayout sticky={stickyHeader} header={headerRegion} {footer}>
      {@render contentRegion()}
    </IrisHeaderLayout>
  </IrisSidebarLayout>
{/if}
