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

interface ControlledColumnChannels {
  visibility: boolean
  order: boolean
  widths: boolean
  pinned: boolean
}

/**
 * Snapshot every channel entering control from the live, non-reactive Core
 * state. `Store.batch` updates state before its deferred notification, so this
 * preserves a batched uncontrolled write that enters control in the same
 * flush. `model.get()` is a plain read (no store subscription) returning a
 * detached clone, so later consumers cannot mutate the captured snapshot.
 */
function captureEnteringUncontrolledColumns(
  model: GridColumnsModel,
  controlled: ControlledColumnChannels,
  wasControlled: ControlledColumnChannels,
  previous: GridColumnsState,
): GridColumnsState {
  const enteringVisibility = controlled.visibility && !wasControlled.visibility
  const enteringOrder = controlled.order && !wasControlled.order
  const enteringWidths = controlled.widths && !wasControlled.widths
  const enteringPinned = controlled.pinned && !wasControlled.pinned
  if (!enteringVisibility && !enteringOrder && !enteringWidths && !enteringPinned) {
    return previous
  }
  const live = model.get()
  return {
    visibility: enteringVisibility ? { ...live.visibility } : previous.visibility,
    order: enteringOrder ? [...live.order] : previous.order,
    widths: enteringWidths ? { ...live.widths } : previous.widths,
    pinned: enteringPinned ? { ...live.pinned } : previous.pinned,
  }
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
    // Do not make this read reactive: callers may own a separate reactive
    // sync for the same core feature.
    void (next.visibility ? JSON.stringify(Object.entries(next.visibility)) : '')
    void (next.order ? JSON.stringify(next.order) : '')
    void (next.widths ? JSON.stringify(Object.entries(next.widths)) : '')
    void (next.pinned ? JSON.stringify(Object.entries(next.pinned)) : '')

    // Capture every entering channel from the live Core state before any
    // controlled sync runs, so a batched uncontrolled write survives handoff.
    // Keep this read non-reactive (do not read `current`): callers may own a
    // separate reactive sync for the same core feature.
    const uncontrolled = captureEnteringUncontrolledColumns(
      model,
      {
        visibility: controlledVisibility,
        order: controlledOrder,
        widths: controlledWidths,
        pinned: controlledPinned,
      },
      {
        visibility: wasVisibilityControlled,
        order: wasOrderControlled,
        widths: wasWidthsControlled,
        pinned: wasPinnedControlled,
      },
      {
        visibility: lastUncontrolledVisibility,
        order: lastUncontrolledOrder,
        widths: lastUncontrolledWidths,
        pinned: lastUncontrolledPinned,
      },
    )
    lastUncontrolledVisibility = uncontrolled.visibility
    lastUncontrolledOrder = uncontrolled.order
    lastUncontrolledWidths = uncontrolled.widths
    lastUncontrolledPinned = uncontrolled.pinned

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
