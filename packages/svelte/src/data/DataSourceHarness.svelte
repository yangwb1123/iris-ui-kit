<script lang="ts" generics="T extends Record<string, unknown>">
  // Test fixture: drives useDataSource and exposes both the live controller (via
  // `onready`) and the reactive state through the DOM so assertions can read it.
  import type { DataSourceConfig } from '@iris-ui/core'
  import { useDataSource, type UseDataSource } from './useDataSource.svelte'

  let {
    config,
    onready,
  }: { config: DataSourceConfig<T>; onready?: (api: UseDataSource<T>) => void } = $props()

  // svelte-ignore state_referenced_locally — one-time init read of config (the hook
  // constructs its controller once, mirroring React's init-once contract).
  const ds = useDataSource(config)
  // svelte-ignore state_referenced_locally — fixture: hand the controller out once.
  onready?.(ds)
</script>

<div data-count>{ds.state.rows.length}</div>
<div data-has-more>{ds.state.hasMore}</div>
<div data-rows>
  {ds.state.rows.map((r) => String((r as Record<string, unknown>).name)).join(',')}
</div>
<div data-ages>
  {ds.state.rows.map((r) => String((r as Record<string, unknown>).age)).join(',')}
</div>
