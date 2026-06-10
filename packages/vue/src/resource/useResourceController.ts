import { onBeforeUnmount, shallowRef, type ShallowRef } from 'vue'
import {
  createResourceController,
  type ResourceController,
  type ResourceControllerConfig,
  type ResourceState,
} from '@iris-ui/core'

export interface UseResourceController<T> extends ResourceController<T> {
  /** The live resource state as a reactive ref (rows, total, page, loading, selectedKeys). */
  state: ShallowRef<ResourceState<T>>
}

/**
 * Vue bridge over the framework-agnostic {@link createResourceController} (L4
 * CRUD list composite). Creates the controller once in `setup()`, mirrors its
 * store into a `shallowRef`, and returns the controller plus that live `state`.
 * A ~15-line thin bridge — all logic lives in `@iris-ui/core`.
 */
export function useResourceController<T>(
  config: ResourceControllerConfig<T>,
): UseResourceController<T> {
  const controller = createResourceController(config)
  const state = shallowRef(controller.getState())
  onBeforeUnmount(controller.subscribe((next) => (state.value = next)))
  // Abort any in-flight fetch + detach the controller's internal subscriptions
  // on unmount (a late response must not write back to a torn-down instance).
  onBeforeUnmount(() => controller.destroy())
  return { ...controller, state }
}
