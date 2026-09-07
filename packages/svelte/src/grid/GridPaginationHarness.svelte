<script lang="ts">
  import { useGridCore, useGridPagination } from './useGrid'

  let paginationOptions: { page: number; total: number } = $props()

  const core = useGridCore()
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to the bridge.
  const pagination = useGridPagination(core, paginationOptions)
  const paginationStore = pagination.pagination
</script>

<output data-testid="page">{$paginationStore.page}</output>
