<script lang="ts">
  import { onMount } from 'svelte'
  import type { ExpansionModel, GridCore } from '@iris-ui-kit/core/grid'
  import { useGridCore, useGridExpansion, type UseGridExpansionOptions } from './useGrid'

  type Row = { id: string }

  type Props = UseGridExpansionOptions<string> & {
    onReady?: (core: GridCore<Row>, model: ExpansionModel<string>) => void
  }

  // Keep the $props proxy intact so the bridge can read replacement callbacks
  // and providers when the existing Core feature invokes them.
  let props: Props = $props()

  const core = useGridCore<Row>()
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to the bridge.
  const expansion = useGridExpansion<Row, string>(core, props)
  const expandedKeys = expansion.expandedKeys

  onMount(() => props.onReady?.(core, expansion.model))
</script>

<output data-testid="expanded-keys">{JSON.stringify($expandedKeys)}</output>
