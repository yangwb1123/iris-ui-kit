<script lang="ts">
  import type { GridColumnsModel, GridCore } from '@iris-ui-kit/core/grid'
  import { useGridColumns, useGridCore } from './useGrid'

  interface Props {
    onCore?: (core: GridCore<{ id: string }>) => void
    onVisibilityChange?: (value: Record<string, boolean>) => void
    onWidthsChange?: (value: Record<string, number>) => void
  }

  let { onCore, onVisibilityChange, onWidthsChange }: Props = $props()

  const core = useGridCore<{ id: string }>()
  const columns = useGridColumns(core, {
    onVisibilityChange: (value) => onVisibilityChange?.(value),
    onWidthsChange: (value) => onWidthsChange?.(value),
  })
  const columnState = columns.state
  const reportCore = (): void => onCore?.(core)
  reportCore()
</script>

<div
  data-features={core.features.join(',')}
  data-model-identity={columns.model === core.invoke<GridColumnsModel>('getColumnsModel')
    ? 'true'
    : 'false'}
>
  <output data-testid="column-state">{JSON.stringify($columnState)}</output>
  <button
    type="button"
    data-testid="sync-visibility"
    onclick={() => columns.model.syncVisibility({ hidden: false })}
  >
    sync visibility
  </button>
  <button
    type="button"
    data-testid="sync-widths"
    onclick={() => columns.model.syncWidths({ name: 120 })}
  >
    sync widths
  </button>
  <button
    type="button"
    data-testid="set-visibility"
    onclick={() => columns.setVisibility({ hidden: true })}
  >
    set visibility
  </button>
  <button type="button" data-testid="set-widths" onclick={() => columns.setWidths({ name: 140 })}>
    set widths
  </button>
  <button type="button" data-testid="reset-widths" onclick={() => columns.resetWidths()}>
    reset widths
  </button>
</div>
