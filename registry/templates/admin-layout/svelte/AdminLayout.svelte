<script lang="ts">
  import type { Snippet } from 'svelte'
  import {
    IrisAdminLayout,
    useAdminPreferences,
    type AdminPreferences,
    type NavNode,
    type TabsNav,
  } from '@iris-ui-kit/svelte/admin'

  interface Props {
    menus: NavNode[]
    activeKey: string
    onNavigate: (key: string) => void
    preferences: AdminPreferences
    tabs?: TabsNav
    appTitle?: string
    logo?: Snippet<[{ collapsed: boolean }]>
    toolbar?: Snippet
    footer?: Snippet
    children?: Snippet<[{ activeKey: string }]>
  }

  let {
    menus,
    activeKey,
    onNavigate,
    preferences: controller,
    tabs,
    appTitle = 'Admin',
    logo,
    toolbar,
    footer,
    children,
  }: Props = $props()
  // svelte-ignore state_referenced_locally — controller identity is stable for the shell lifetime.
  const preferences = useAdminPreferences(controller)
  const { state } = preferences
</script>

<!-- Stable shell: pages remain statically imported and render through children. -->
<div data-admin-layout data-density={$state.density}>
  <IrisAdminLayout
    {menus}
    {activeKey}
    onActiveKeyChange={onNavigate}
    collapsed={$state.collapsed}
    onCollapsedChange={(value) => preferences.set('collapsed', value)}
    mode={$state.navigationMode}
    menuAlign={$state.menuAlign}
    contentWidth={$state.contentWidth}
    contentHeight={$state.contentHeight}
    showTabs={$state.showTabs}
    showBreadcrumb={$state.showBreadcrumb}
    stickyHeader={$state.stickyHeader}
    stickyTabs={$state.stickyTabs}
    {tabs}
    {appTitle}
    {logo}
    {toolbar}
    {footer}
    {children}
  />
</div>
