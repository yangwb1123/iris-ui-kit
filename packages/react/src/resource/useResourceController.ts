import * as React from 'react'
import {
  createResourceController,
  type ResourceController,
  type ResourceControllerConfig,
  type ResourceState,
} from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseResourceController<T> extends ResourceController<T> {
  /** The live resource state (rows, total, page, loading, selectedKeys). */
  state: ResourceState<T>
}

/**
 * React bridge over the framework-agnostic {@link createResourceController} (L4
 * CRUD list composite). Creates the controller once, subscribes to its store,
 * and returns the controller plus its live `state`. A thin bridge — all logic
 * lives in `@iris-ui-kit/core`.
 *
 * The controller is constructed with `immediate: false` so no fetch fires during
 * React's (side-effect-free) render phase; the initial load is kicked from an
 * effect instead, and the controller is torn down on unmount so an in-flight
 * request never writes back to an unmounted component.
 */
export function useResourceController<T>(
  config: ResourceControllerConfig<T>,
): UseResourceController<T> {
  const ref = React.useRef<ResourceController<T> | null>(null)
  if (ref.current === null) ref.current = createResourceController({ ...config, immediate: false })
  const controller = ref.current
  const immediate = config.immediate !== false

  // Construct-once controller: load on mount (when immediate) + tear down on
  // unmount. `immediate` is captured at mount; it is not a reactive dependency.
  React.useEffect(() => {
    if (immediate) void controller.load()
    return () => controller.destroy()
  }, [controller, immediate])

  const state = useStore(controller.store)
  return React.useMemo(() => ({ ...controller, state }), [controller, state])
}
