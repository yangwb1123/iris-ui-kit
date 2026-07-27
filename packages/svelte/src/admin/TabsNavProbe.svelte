<script lang="ts">
  // Test fixture: surfaces a useTabsNav binding's reactive stores into the DOM.
  import type { TabsNav } from '@iris-ui-kit/core'
  import { useTabsNav, type UseTabsNavReturn } from './useTabsNav'

  let { nav, onready }: { nav: TabsNav; onready?: (api: UseTabsNavReturn) => void } = $props()

  // svelte-ignore state_referenced_locally — `nav` is a stable store instance.
  const api = useTabsNav(nav)
  // svelte-ignore state_referenced_locally — hand the api out synchronously.
  onready?.(api)
  const { tabs, activeKey, cacheKeys } = api
</script>

<span data-active>{$activeKey ?? '—'}</span>
<span data-keys>{$tabs.map((t) => t.key).join(',')}</span>
<span data-cache>{$cacheKeys.join(',')}</span>
