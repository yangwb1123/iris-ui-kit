import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue'
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
  status: ComputedRef<AsyncStatus>
  data: ComputedRef<T | undefined>
  error: ComputedRef<unknown>
  isLoading: ComputedRef<boolean>
  isError: ComputedRef<boolean>
  load: AsyncResource<T, P>['load']
  reload: AsyncResource<T, P>['reload']
  mutate: AsyncResource<T, P>['mutate']
  reset: AsyncResource<T, P>['reset']
}

/**
 * Vue binding for the framework-agnostic async resource. Creates the resource
 * in `setup()` (runs once, so the fetcher closure stays live) and bridges its
 * state into computed refs.
 *
 * ```ts
 * const users = useAsyncResource(() => api.listUsers(), { immediate: true })
 * // <IrisTable :data="users.data.value ?? []" :loading="users.isLoading.value" />
 * ```
 */
export function useAsyncResource<T, P extends unknown[] = []>(
  fetcher: (...params: P) => Promise<T>,
  options: UseAsyncResourceOptions<T> = {},
): UseAsyncResourceReturn<T, P> {
  const config: AsyncResourceConfig<T> =
    'initialData' in options ? { initialData: options.initialData } : {}
  const resource = createAsyncResource<T, P>(fetcher, config)

  const state = ref(resource.getState()) as Ref<AsyncState<T>>
  const unsubscribe = resource.subscribe((next) => {
    state.value = next
  })
  onBeforeUnmount(unsubscribe)

  if (options.immediate) {
    onMounted(() => {
      void resource.load(...([] as unknown as P))
    })
  }

  return {
    status: computed(() => state.value.status),
    data: computed(() => state.value.data),
    error: computed(() => state.value.error),
    isLoading: computed(() => state.value.status === 'loading'),
    isError: computed(() => state.value.status === 'error'),
    load: resource.load,
    reload: resource.reload,
    mutate: resource.mutate,
    reset: resource.reset,
  }
}
