import { fromStore, type Readable } from 'svelte/store'
import type { GridColumnsModel, GridColumnsState } from '@iris-ui-kit/core/grid'

interface GridColumnsBridgeOptions {
  visibility?: Record<string, boolean>
  defaultVisibility?: Record<string, boolean>
  order?: string[]
  defaultOrder?: string[]
  widths?: Record<string, number>
  defaultWidths?: Record<string, number>
  pinned?: Record<string, 'left' | 'right' | null>
  defaultPinned?: Record<string, 'left' | 'right' | null>
}

/** Install the Svelte rune bridge for controlled grid column-state props. */
export function syncGridColumnsVisibility(
  model: GridColumnsModel,
  state: Readable<GridColumnsState>,
  read: () => GridColumnsBridgeOptions,
): void {
  const current = fromStore(state)
  let lastUncontrolledVisibility = { ...(read().defaultVisibility ?? {}) }
  let lastUncontrolledOrder = [...(read().defaultOrder ?? [])]
  let lastUncontrolledWidths = { ...(read().defaultWidths ?? {}) }
  let lastUncontrolledPinned = { ...(read().defaultPinned ?? {}) }
  let wasVisibilityControlled = read().visibility !== undefined
  let wasOrderControlled = read().order !== undefined
  let wasWidthsControlled = read().widths !== undefined
  let wasPinnedControlled = read().pinned !== undefined

  $effect(() => {
    const next = read()
    const controlledVisibility = next.visibility !== undefined
    const controlledOrder = next.order !== undefined
    const controlledWidths = next.widths !== undefined
    const controlledPinned = next.pinned !== undefined
    // Read entries too, so a reactive props proxy observes in-place updates.
    // Do not read the model store here: callers may own a separate reactive
    // sync for the same core feature.
    void (next.visibility ? JSON.stringify(Object.entries(next.visibility)) : '')
    void (next.order ? JSON.stringify(next.order) : '')
    void (next.widths ? JSON.stringify(Object.entries(next.widths)) : '')
    void (next.pinned ? JSON.stringify(Object.entries(next.pinned)) : '')

    if (controlledVisibility) model.syncVisibility(next.visibility ?? {})
    else if (wasVisibilityControlled) model.syncVisibility(lastUncontrolledVisibility)
    if (controlledOrder) model.syncOrder(next.order ?? [])
    else if (wasOrderControlled) model.syncOrder(lastUncontrolledOrder)
    if (controlledWidths) model.syncWidths(next.widths ?? {})
    else if (wasWidthsControlled) model.syncWidths(lastUncontrolledWidths)
    if (controlledPinned) model.syncPinned(next.pinned ?? {})
    else if (wasPinnedControlled) model.syncPinned(lastUncontrolledPinned)

    wasVisibilityControlled = controlledVisibility
    wasOrderControlled = controlledOrder
    wasWidthsControlled = controlledWidths
    wasPinnedControlled = controlledPinned
  })
  $effect(() => {
    const snapshot = current.current
    if (!wasVisibilityControlled) lastUncontrolledVisibility = { ...snapshot.visibility }
    if (!wasOrderControlled) lastUncontrolledOrder = [...snapshot.order]
    if (!wasWidthsControlled) lastUncontrolledWidths = { ...snapshot.widths }
    if (!wasPinnedControlled) lastUncontrolledPinned = { ...snapshot.pinned }
  })
}
