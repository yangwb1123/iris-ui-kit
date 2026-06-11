<script lang="ts">
  // Test fixture: drives useAdminShell and surfaces its reactive values into the
  // DOM, plus hands the (stable) navigate / syncFromTab api out via onready.
  import type { NavNode, TabsNav } from '@iris-ui/core'
  import { useAdminShell, type UseAdminShellReturn } from './useAdminShell.svelte'

  let {
    menus,
    activeKey,
    defaultActiveKey,
    onActiveKeyChange,
    onSelect,
    tabs,
    onready,
  }: {
    menus: NavNode[]
    activeKey?: string
    defaultActiveKey?: string
    onActiveKeyChange?: (key: string) => void
    onSelect?: (key: string, node: NavNode) => void
    tabs?: TabsNav
    onready?: (api: UseAdminShellReturn) => void
  } = $props()

  const shell = useAdminShell(() => ({
    menus,
    activeKey,
    defaultActiveKey,
    onActiveKeyChange,
    onSelect,
    tabs,
  }))
  // svelte-ignore state_referenced_locally — hand the stable api out synchronously.
  onready?.(shell)
</script>

<span data-active>{shell.activeKey}</span>
<span data-trail>{shell.breadcrumb.map((n) => n.key).join(',')}</span>
