<script lang="ts">
  // Test fixture: drives IrisAdminLayout with a content render-prop Snippet.
  import type { NavNode, TabsNav } from '@iris-ui-kit/core'
  import IrisAdminLayout from './AdminLayout.svelte'
  import type { IrisAdminLayoutMode } from './types'

  let {
    menus,
    activeKey,
    defaultActiveKey,
    onActiveKeyChange,
    onSelect,
    collapsed,
    onCollapsedChange,
    mode,
    tabs,
  }: {
    menus: NavNode[]
    activeKey?: string
    defaultActiveKey?: string
    onActiveKeyChange?: (key: string) => void
    onSelect?: (key: string, node: NavNode) => void
    collapsed?: boolean
    onCollapsedChange?: (next: boolean) => void
    mode?: IrisAdminLayoutMode
    tabs?: TabsNav
  } = $props()
</script>

<IrisAdminLayout
  {menus}
  {activeKey}
  {defaultActiveKey}
  {onActiveKeyChange}
  {onSelect}
  {collapsed}
  {onCollapsedChange}
  {mode}
  {tabs}
>
  {#snippet children(s)}
    <main data-page>{s.activeKey}</main>
  {/snippet}
</IrisAdminLayout>
