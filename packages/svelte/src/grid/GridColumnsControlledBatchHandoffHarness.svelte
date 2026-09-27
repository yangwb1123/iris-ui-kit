<script lang="ts">
  import { useGridColumns, useGridCore, type UseGridColumnsOptions } from './useGrid'

  interface Props {
    onColumns?: (columns: ReturnType<typeof useGridColumns>) => void
  }

  let props: Props = $props()
  let options = $state<UseGridColumnsOptions>({
    defaultVisibility: { hidden: false },
    defaultOrder: ['name', 'age'],
    defaultWidths: { name: 100, age: 200 },
    defaultPinned: { name: 'left', age: 'right' },
  })

  const core = useGridCore<{ id: string }>()
  // svelte-ignore state_referenced_locally — pass the reactive $state options object to the bridge.
  const columns = useGridColumns(core, options)
  const columnState = columns.state
  const reportColumns = (): void => props.onColumns?.(columns)
  reportColumns()

  const handoffVisibility = (): void => {
    columns.model.store.batch(() => {
      columns.model.toggleVisibility('hidden')
      options.visibility = { hidden: false }
    })
  }
  const releaseVisibility = (): void => {
    options.visibility = undefined
  }
  const handoffAll = (): void => {
    columns.model.store.batch(() => {
      columns.model.toggleVisibility('hidden')
      columns.model.setOrder(['age', 'name'])
      columns.model.setWidths({ name: 116, age: 216 })
      columns.model.setPinned('name', null)
      options.visibility = { hidden: false }
      options.order = ['name']
      options.widths = { name: 310, age: 260 }
      options.pinned = { name: 'right', age: 'left' }
    })
  }
  const releaseAll = (): void => {
    options.visibility = undefined
    options.order = undefined
    options.widths = undefined
    options.pinned = undefined
  }
</script>

<output data-testid="column-state">{JSON.stringify($columnState)}</output>
<button type="button" data-testid="handoff-visibility" onclick={handoffVisibility}
  >handoff visibility</button
>
<button type="button" data-testid="release-visibility" onclick={releaseVisibility}
  >release visibility</button
>
<button type="button" data-testid="handoff-all" onclick={handoffAll}>handoff all</button>
<button type="button" data-testid="release-all" onclick={releaseAll}>release all</button>
