import { onMounted, onScopeDispose, shallowRef, type ShallowRef } from 'vue'
import {
  createResourceController,
  type ResourceController,
  type ResourceControllerConfig,
  type ResourceState,
} from '@iris-ui-kit/core'

export interface UseResourceController<T> extends ResourceController<T> {
  /** The live resource state as a reactive ref (rows, total, page, loading, selectedKeys). */
  state: ShallowRef<ResourceState<T>>
}

/**
 * Vue bridge over the framework-agnostic {@link createResourceController} (L4
 * CRUD list composite). Creates the controller once in `setup()`, mirrors its
 * store into a `shallowRef`, and returns the controller plus that live `state`.
 * A thin bridge — all logic lives in `@iris-ui-kit/core`.
 *
 * Constructed with `immediate: false` so no fetch fires during `setup()`
 * (SSR-safe: server rendering never runs `onMounted`); the initial load is
 * kicked from `onMounted` when the caller's config says `immediate !== false`.
 * The `onMounted` registration is conditional on that flag — inside a bare
 * `effectScope` there is no component instance and Vue would warn on an
 * unconditional registration. The controller is torn down on scope dispose
 * (aborting any in-flight request and detaching the state mirror), so a late
 * response never writes back to a torn-down instance.
 */
export function useResourceController<T>(
  config: ResourceControllerConfig<T>,
): UseResourceController<T> {
  const controller = createResourceController({ ...config, immediate: false })
  const immediate = config.immediate !== false

  if (immediate) {
    onMounted(() => void controller.load())
  }
  // Abort any in-flight fetch + detach the controller's internal subscriptions
  // on scope dispose (a late response must not write back to a torn-down
  // instance). Fires on unmount inside a component scope and on `scope.stop()`
  // inside a bare effectScope.
  onScopeDispose(() => controller.destroy())

  const state = shallowRef(controller.getState())
  onScopeDispose(controller.subscribe((next) => (state.value = next)))
  return { ...controller, state }
}
