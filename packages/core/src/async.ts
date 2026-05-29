import { createStore, type Store } from './store'

/**
 * Framework-agnostic async data orchestration. Owns the fetch lifecycle
 * (`idle → loading → success | error`) with stale-result race protection, so
 * data components (Table / Tree / List) get a uniform contract for
 * server-driven loading instead of each caller re-implementing it. Pairs with
 * the Table `loading` / `error` states. Adapters wrap it as `useAsyncResource`.
 */

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  status: AsyncStatus
  data: T | undefined
  error: unknown
}

export interface AsyncResourceConfig<T> {
  /** Seed data; starts the resource in `success` instead of `idle`. */
  initialData?: T
}

export interface AsyncResource<T, P extends unknown[] = []> {
  store: Store<AsyncState<T>>
  getState(): AsyncState<T>
  subscribe(listener: (state: AsyncState<T>) => void): () => void
  /**
   * Run the fetcher with `params`. Transitions to `loading` (retaining prior
   * `data` for stale-while-revalidate), then `success` / `error`. Concurrent
   * calls are token-guarded: only the most recent call applies its result, so
   * a slow earlier request can't clobber a newer one. Resolves to the data on
   * success, or `undefined` if this call was superseded or errored.
   */
  load(...params: P): Promise<T | undefined>
  /** Re-run `load` with the params from the previous call (defaults to none). */
  reload(): Promise<T | undefined>
  /** Imperatively set data (optimistic updates); moves status to `success`. */
  mutate(updater: T | ((prev: T | undefined) => T)): void
  /** Return to the initial state (re-seeding `initialData` if provided). */
  reset(): void
}

export function createAsyncResource<T, P extends unknown[] = []>(
  fetcher: (...params: P) => Promise<T>,
  config: AsyncResourceConfig<T> = {},
): AsyncResource<T, P> {
  const hasInitial = 'initialData' in config
  const initial: AsyncState<T> = {
    status: hasInitial ? 'success' : 'idle',
    data: config.initialData,
    error: undefined,
  }

  const store = createStore<AsyncState<T>>({ ...initial })

  // Monotonic token: only the latest in-flight load may write a terminal
  // state. A stale request that resolves later is ignored.
  let token = 0
  let lastParams: P | null = null

  const load = async (...params: P): Promise<T | undefined> => {
    const current = ++token
    lastParams = params
    store.setState((s) => ({ ...s, status: 'loading', error: undefined }))
    try {
      const data = await fetcher(...params)
      if (current !== token) return undefined // superseded
      store.setState({ status: 'success', data, error: undefined })
      return data
    } catch (error) {
      if (current !== token) return undefined // superseded
      // Retain prior data so the UI can show stale content alongside the error.
      store.setState((s) => ({ ...s, status: 'error', error }))
      return undefined
    }
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    load,
    reload: () => load(...((lastParams ?? []) as P)),
    mutate: (updater) => {
      store.setState((s) => {
        const next =
          typeof updater === 'function' ? (updater as (prev: T | undefined) => T)(s.data) : updater
        return { status: 'success', data: next, error: undefined }
      })
    },
    reset: () => {
      // Invalidate any in-flight load so it can't apply after reset.
      token += 1
      lastParams = null
      store.setState({ ...initial })
    },
  }
}
