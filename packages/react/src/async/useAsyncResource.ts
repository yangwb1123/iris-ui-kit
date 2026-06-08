import * as React from 'react'
import {
  createAsyncResource,
  type AsyncResource,
  type AsyncResourceConfig,
  type AsyncState,
} from '@iris-ui/core'
import { useStore } from '../useStore'

export interface UseAsyncResourceOptions<T> extends AsyncResourceConfig<T> {
  /** Run `load()` (no params) once on mount. Default `false`. */
  immediate?: boolean
}

export interface UseAsyncResourceReturn<T, P extends unknown[]> extends AsyncState<T> {
  isLoading: boolean
  isError: boolean
  load: AsyncResource<T, P>['load']
  reload: AsyncResource<T, P>['reload']
  mutate: AsyncResource<T, P>['mutate']
  cancel: AsyncResource<T, P>['cancel']
  reset: AsyncResource<T, P>['reset']
}

/**
 * React binding for the framework-agnostic async resource. Instantiates the
 * resource once and bridges it via `useSyncExternalStore`. The fetcher is read
 * through a ref each render so it never goes stale, while seeding/immediacy are
 * captured on first render.
 *
 * ```tsx
 * const users = useAsyncResource(() => api.listUsers(), { immediate: true })
 * <IrisTable data={users.data ?? []} loading={users.isLoading} error={users.isError} />
 * ```
 */
export function useAsyncResource<T, P extends unknown[] = []>(
  fetcher: (...params: P) => Promise<T>,
  options: UseAsyncResourceOptions<T> = {},
): UseAsyncResourceReturn<T, P> {
  const latest = React.useRef(fetcher)
  latest.current = fetcher

  const ref = React.useRef<AsyncResource<T, P> | null>(null)
  if (ref.current === null) {
    const config: AsyncResourceConfig<T> =
      'initialData' in options ? { initialData: options.initialData } : {}
    ref.current = createAsyncResource<T, P>((...params) => latest.current(...params), config)
  }
  const resource = ref.current
  const state = useStore(resource.store)

  const immediate = React.useRef(options.immediate ?? false)
  React.useEffect(() => {
    if (immediate.current) void resource.load(...([] as unknown as P))
    // Abort any in-flight request on unmount so it can't write back into an
    // unmounted component (the token guard already prevents the state write;
    // this also cancels the underlying request when the fetcher honors signal).
    return () => resource.cancel()
  }, [resource])

  return {
    ...state,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    load: resource.load,
    reload: resource.reload,
    mutate: resource.mutate,
    cancel: resource.cancel,
    reset: resource.reset,
  }
}
