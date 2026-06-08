/**
 * Framework-agnostic data-state model shared by data-bearing components
 * (Table, List, Tree, …). The four states are mutually exclusive and resolved
 * with a fixed precedence so every adapter behaves identically.
 */

export type DataState = 'content' | 'empty' | 'loading' | 'error'

export interface DataStateInput {
  /** An async load is in flight. */
  loading?: boolean
  /** The last load failed. Takes precedence over everything else. */
  error?: boolean
  /** There is no data to show (and we are not loading/errored). */
  empty?: boolean
  /**
   * There is already-loaded content to show. When set, a load in flight is
   * treated as a **background revalidate**: the resolver returns `'content'`
   * (keep showing the data) instead of flashing `'loading'`/`'error'` over it —
   * the stale-while-revalidate behavior. Defaults to `false` (no change to the
   * original `error → loading → empty → content` precedence).
   */
  hasContent?: boolean
}

/**
 * Resolve the active {@link DataState}. Base precedence — `error → loading →
 * empty → content` — matches `IrisTable`'s body so all data components agree on
 * which state wins when more than one flag is set. When `hasContent` is set and
 * a load is in flight, the resolver short-circuits to `'content'` so a
 * background refresh shows the existing data rather than a spinner or a stale
 * error (stale-while-revalidate). This is purely additive: callers that don't
 * pass `hasContent` get the original behavior unchanged.
 */
export function resolveDataState(input: DataStateInput): DataState {
  if (input.loading && input.hasContent) return 'content'
  if (input.error) return 'error'
  if (input.loading) return 'loading'
  if (input.empty) return 'empty'
  return 'content'
}
