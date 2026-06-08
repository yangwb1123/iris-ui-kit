/**
 * Framework-agnostic roving-focus index math — the C-layer **material** behind
 * keyboard navigation in List, Menu, Select, Combobox, Tree, ToggleGroup, the
 * admin NavMenu/Tabs, etc. (today the same next-enabled-index-with-wrap loop is
 * re-implemented per component per framework). These are pure: they compute
 * which index to focus; the actual `element.focus()` stays in the adapter.
 */

/**
 * Step `delta` positions from `current`, skipping disabled items, optionally
 * wrapping around the ends. Returns the next focusable index, or `current` if
 * none is focusable.
 */
export function nextEnabledIndex(
  current: number,
  delta: number,
  count: number,
  isEnabled: (index: number) => boolean = () => true,
  loop = true,
): number {
  if (count <= 0) return -1
  const step = delta === 0 ? 1 : delta > 0 ? 1 : -1
  let index = current
  for (let i = 0; i < count; i += 1) {
    index += step
    if (index < 0) {
      if (!loop) return firstEnabledIndex(count, isEnabled)
      index = count - 1
    } else if (index >= count) {
      if (!loop) return lastEnabledIndex(count, isEnabled)
      index = 0
    }
    if (isEnabled(index)) return index
  }
  return current
}

/** First focusable index, or -1. */
export function firstEnabledIndex(
  count: number,
  isEnabled: (index: number) => boolean = () => true,
): number {
  for (let i = 0; i < count; i += 1) if (isEnabled(i)) return i
  return -1
}

/** Last focusable index, or -1. */
export function lastEnabledIndex(
  count: number,
  isEnabled: (index: number) => boolean = () => true,
): number {
  for (let i = count - 1; i >= 0; i -= 1) if (isEnabled(i)) return i
  return -1
}
