import { readable, derived, type Readable } from 'svelte/store'
import { onMount } from 'svelte'
import {
  createAsyncResource,
  type AsyncResourceConfig,
  type AsyncState,
  type AsyncStatus,
} from '@iris-ui/core'

export interface UseAsyncResourceOptions<T> extends AsyncResourceConfig<T> {
  immediate?: boolean
}

export interface UseAsyncResourceReturn<T, P extends unknown[]> {
  status: Readable<AsyncStatus>
  data: Readable<T | undefined>
  error: Readable<unknown>
  isLoading: Readable<boolean>
  isError: Readable<boolean>
  load: (...params: P) => Promise<void>
  reload: () => Promise<void>
  mutate: (data: T) => void
  reset: () => void
}

/**
 * Svelte binding for the framework-agnostic async resource.
 * Returns Svelte stores for reactive state in components (`$status` etc.)
 */
export function useAsyncResource<T, P extends unknown[] = []>(
  fetcher: (...params: P) => Promise<T>,
  options: UseAsyncResourceOptions<T> = {},
): UseAsyncResourceReturn<T, P> {
  const config: AsyncResourceConfig<T> =
    'initialData' in options ? { initialData: options.initialData } : {}
  const resource = createAsyncResource<T, P>(fetcher, config)

  const state = readable<AsyncState<T>>(resource.getState(), (set) => {
    return resource.subscribe(set)
  })

  if (options.immediate) {
    onMount(() => {
      void resource.load(...([] as unknown as P))
    })
  }

  return {
    status: derived(state, ($s) => $s.status),
    data: derived(state, ($s) => $s.data),
    error: derived(state, ($s) => $s.error),
    isLoading: derived(state, ($s) => $s.status === 'loading'),
    isError: derived(state, ($s) => $s.status === 'error'),
    load: ((...params: P) => resource.load(...params).then(() => undefined)) as (
      ...params: P
    ) => Promise<void>,
    reload: () => resource.reload().then(() => undefined),
    mutate: resource.mutate,
    reset: resource.reset,
  }
}
