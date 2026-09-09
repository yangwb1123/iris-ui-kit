import { writable, type Readable } from 'svelte/store'
import {
  createGridPaginationProjection,
  type GridPaginationModel,
  type GridPaginationState,
} from '@iris-ui-kit/core/grid'

export interface GridPaginationSync extends Readable<GridPaginationState> {
  rebase(): void
}

/** Install the Svelte rune bridge for controlled grid pagination props. */
export function syncGridPagination(
  model: GridPaginationModel,
  read: () => Partial<GridPaginationState>,
): GridPaginationSync {
  const initial = read()
  const projection = createGridPaginationProjection(model, initial)
  const output = writable(projection.project(model.get(), initial))

  $effect(() => {
    const unsubscribe = model.store.subscribe((state) =>
      output.set(projection.project(state, read())),
    )
    return unsubscribe
  })
  $effect(() => {
    const next = read()
    projection.sync(next)
    output.set(projection.project(model.get(), next))
  })
  $effect(() => () => projection.dispose())

  // Keep the existing readable store shape while exposing the same projection
  // to imperative setters. No second snapshot or projection is created.
  return Object.assign(output, {
    // Setters can run before Svelte replays the prop-sync effect. Re-read the
    // live options through the same projection so the model write sees the
    // accepted controlled values synchronously.
    rebase: () => projection.sync(read()),
  })
}
