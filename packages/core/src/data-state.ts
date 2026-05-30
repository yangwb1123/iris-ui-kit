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
}

/**
 * Resolve the active {@link DataState}. Precedence — `error → loading → empty
 * → content` — matches `IrisTable`'s body so all data components agree on which
 * state wins when more than one flag is set (e.g. a stale-but-errored reload).
 */
export function resolveDataState(input: DataStateInput): DataState {
  if (input.error) return 'error'
  if (input.loading) return 'loading'
  if (input.empty) return 'empty'
  return 'content'
}
