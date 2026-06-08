import type { Accessor } from 'solid-js'
import {
  createResourceController,
  type ResourceController,
  type ResourceControllerConfig,
  type ResourceState,
} from '@iris-ui/core'
import { useStore } from '../useStore'

export interface UseResourceController<T> extends ResourceController<T> {
  /** The live resource state as a Solid accessor — call `state()` to read. */
  state: Accessor<ResourceState<T>>
}

/**
 * Solid bridge over the framework-agnostic {@link createResourceController} (L4
 * CRUD list composite). Creates the controller once (a Solid component body runs
 * once), bridges its store into a signal via {@link useStore}, and returns the
 * controller plus its live `state` accessor. A ~15-line thin bridge — all logic
 * lives in `@iris-ui/core`.
 */
export function useResourceController<T>(
  config: ResourceControllerConfig<T>,
): UseResourceController<T> {
  const controller = createResourceController(config)
  const state = useStore(controller.store)
  return { ...controller, state }
}
