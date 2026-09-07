import type { GridPaginationModel, GridPaginationState } from '@iris-ui-kit/core/grid'

/** Install the Svelte rune bridge for controlled grid pagination props. */
export function syncGridPagination(
  model: GridPaginationModel,
  read: () => Partial<GridPaginationState>,
): void {
  $effect(() => {
    const next = read()
    if (Object.keys(next).length > 0) model.sync(next)
  })
}
