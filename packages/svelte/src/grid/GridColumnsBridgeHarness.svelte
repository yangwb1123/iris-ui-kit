<script lang="ts">
  import type { GridColumnsModel, GridCore } from '@iris-ui-kit/core/grid'
  import { useGridColumns, useGridCore } from './useGrid'

  interface Props {
    visibility?: Record<string, boolean>
    defaultVisibility?: Record<string, boolean>
    order?: string[]
    defaultOrder?: string[]
    widths?: Record<string, number>
    defaultWidths?: Record<string, number>
    pinned?: Record<string, 'left' | 'right' | null>
    defaultPinned?: Record<string, 'left' | 'right' | null>
    onCore?: (core: GridCore<{ id: string }>) => void
    onColumns?: (columns: ReturnType<typeof useGridColumns>) => void
    onVisibilityChange?: (value: Record<string, boolean>) => void
    onOrderChange?: (value: string[] | undefined) => void
    onWidthsChange?: (value: Record<string, number>) => void
    onPinnedChange?: (key: string, side: 'left' | 'right' | null) => void
  }

  // Keep the $props proxy intact so the rune bridge can track replacements.
  let props: Props = $props()

  const core = useGridCore<{ id: string }>()
  // svelte-ignore state_referenced_locally — pass the reactive $props proxy to the bridge.
  const columns = useGridColumns(core, props)
  const columnState = columns.state
  const reportCore = (): void => props.onCore?.(core)
  const reportColumns = (): void => props.onColumns?.(columns)
  reportCore()
  reportColumns()
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
    data-testid="toggle-visibility"
    onclick={() => columns.toggleVisibility('hidden')}
  >
    toggle visibility
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
  <button
    type="button"
    data-testid="edit-columns"
    onclick={() => {
      columns.setVisibility({ hidden: true })
      columns.setOrder(['age', 'name'])
      columns.setWidths({ name: 116 })
      columns.setPinned('name', null)
    }}
  >
    edit columns
  </button>
</div>
