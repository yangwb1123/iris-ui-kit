import { onDestroy } from 'svelte'
import type { Readable } from 'svelte/store'
import {
  createResourceController,
  type ResourceController,
  type ResourceControllerConfig,
  type ResourceState,
} from '@iris-ui/core'
import { toStore } from '../useStore'

export interface UseResourceController<T> extends ResourceController<T> {
  /** Live resource state as a Svelte readable; read with `$state` in markup. */
  state: Readable<ResourceState<T>>
}

/**
 * Svelte bridge over the framework-agnostic {@link createResourceController}
 * (L4 CRUD list composite). Svelte component setup runs once per instance, so
 * the controller is created directly and its store surfaced as a readable
 * `state`. A thin bridge — all logic lives in `@iris-ui/core`.
 */
export function useResourceController<T>(
  config: ResourceControllerConfig<T>,
): UseResourceController<T> {
  const controller = createResourceController(config)
  // Abort any in-flight fetch + detach the controller's internal subscriptions
  // on unmount (a late response must not write back to a torn-down instance).
  onDestroy(() => controller.destroy())
  return { ...controller, state: toStore(controller.store) }
}
