import { createSignal, onCleanup, onMount, type Accessor } from 'solid-js'
import {
  createAsyncResource,
  type AsyncResource,
  type AsyncResourceConfig,
  type AsyncState,
  type AsyncStatus,
} from '@iris-ui/core'

export interface UseAsyncResourceOptions<T> extends AsyncResourceConfig<T> {
  /** Run `load()` (no params) once on mount. Default `false`. */
  immediate?: boolean
}

export interface UseAsyncResourceReturn<T, P extends unknown[]> {
  status: Accessor<AsyncStatus>
  data: Accessor<T | undefined>
  error: Accessor<unknown>
  isLoading: Accessor<boolean>
  isError: Accessor<boolean>
  load: AsyncResource<T, P>['load']
  reload: AsyncResource<T, P>['reload']
  mutate: AsyncResource<T, P>['mutate']
  cancel: AsyncResource<T, P>['cancel']
  reset: AsyncResource<T, P>['reset']
}

/**
 * Solid binding for the framework-agnostic async resource. Creates the
 * resource in the calling component and bridges its state into Solid signals.
 */
export function useAsyncResource<T, P extends unknown[] = []>(
  fetcher: (...params: P) => Promise<T>,
  options: UseAsyncResourceOptions<T> = {},
): UseAsyncResourceReturn<T, P> {
  const config: AsyncResourceConfig<T> =
    'initialData' in options ? { initialData: options.initialData } : {}
  const resource = createAsyncResource<T, P>(fetcher, config)

  const [state, setState] = createSignal<AsyncState<T>>(resource.getState())
  const unsubscribe = resource.subscribe((next) => {
    setState(next as AsyncState<T>)
  })
  onCleanup(unsubscribe)
  // Abort any in-flight request on unmount so it can't write back after teardown
  // (the token guard already blocks the state write; this also cancels the
  // underlying request when the fetcher honors signal).
  onCleanup(() => resource.cancel())

  if (options.immediate) {
    onMount(() => {
      void resource.load(...([] as unknown as P))
    })
  }

  return {
    status: () => state().status,
    data: () => state().data,
    error: () => state().error,
    isLoading: () => state().status === 'loading',
    isError: () => state().status === 'error',
    load: resource.load,
    reload: resource.reload,
    mutate: resource.mutate,
    cancel: resource.cancel,
    reset: resource.reset,
  }
}
