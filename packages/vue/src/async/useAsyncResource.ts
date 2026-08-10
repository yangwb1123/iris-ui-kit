import {
  computed,
  isRef,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
import {
  createAsyncResource,
  type AsyncResource,
  type AsyncResourceConfig,
  type AsyncState,
  type AsyncStatus,
} from '@iris-ui-kit/core'

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
  cancel: AsyncResource<T, P>['cancel']
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
 *
 * The fetcher may be reactive — pass `ref(fetcher)` or `computed(() => fetcher)`
 * and the *current* closure is used on every `load()`/`reload()`. Updating it
 * does NOT auto-refetch; call `reload()` yourself:
 *
 * ```ts
 * const users = useAsyncResource(computed(() => api.listUsers(props.id)), { immediate: true })
 * watch(() => props.id, () => void users.reload())
 * ```
 *
 * A bare getter `() => fetcher` is indistinguishable from a plain zero-arg
 * fetcher and is treated as one — use `computed`/`ref` for reactive fetchers.
 */
export function useAsyncResource<T, P extends unknown[] = []>(
  fetcher: MaybeRefOrGetter<(...params: P) => Promise<T>>,
  options: UseAsyncResourceOptions<T> = {},
): UseAsyncResourceReturn<T, P> {
  // Plain-object holder (the Vue analog of React's `latest.current` ref):
  // core only ever sees the wrapper below, which re-reads `holder.current` at
  // call time — so `load()`, `reload()` and its `lastParams` replay all use
  // the fresh closure for the component's whole lifetime.
  const holder: { current: (...params: P) => Promise<T> } = {
    // isRef-only resolution. NEVER toValue() here: the element type is itself
    // a function, so toValue(fetcher) would *invoke the fetcher at setup*
    // (spurious request) and toValue(getter) would do the same. isRef narrows
    // to the only unambiguous reactive form: ref(fetcher) / computed(() =>
    // fetcher) / shallowRef(fetcher) — a ComputedRef IS a Ref.
    // F3 elision point — the ONE explicit narrowing cast: after the isRef
    // guard the else arm is `F | (() => F)`, and the bare-getter arm's return
    // `F` (a function) is not assignable to `F` (TS2322). No runtime
    // discriminant distinguishes a plain fetcher from a bare getter (both are
    // functions), so the cast encodes exactly the documented F3 ambiguity and
    // adds no unsafety beyond F3.
    current: (isRef(fetcher) ? fetcher.value : fetcher) as (...params: P) => Promise<T>,
  }
  if (isRef(fetcher)) {
    // Ref sources only. watch(fn, cb) would treat a plain function source as a
    // getter: evaluate it once at setup (spurious fetcher invocation) and track
    // its deps. flush: 'sync' (precedent useAdminShell.ts:67) guarantees a
    // load()/reload() in the same tick as the ref assignment sees the new
    // closure. Plain-object holder => the swap is not reactive, no re-render.
    watch(
      fetcher,
      (next) => {
        holder.current = next
      },
      { flush: 'sync' },
    )
  }

  const config: AsyncResourceConfig<T> =
    'initialData' in options ? { initialData: options.initialData } : {}
  const resource = createAsyncResource<T, P>((...params) => holder.current(...params), config)

  const state = ref(resource.getState()) as Ref<AsyncState<T>>
  const unsubscribe = resource.subscribe((next) => {
    state.value = next
  })
  onBeforeUnmount(() => {
    unsubscribe()
    // Abort any in-flight request on unmount so it can't write back into an
    // unmounted component (and cancels the underlying request when the fetcher
    // honors `signal`). Idempotent and safe with no in-flight load.
    resource.cancel()
  })

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
    cancel: resource.cancel,
    reset: resource.reset,
  }
}
