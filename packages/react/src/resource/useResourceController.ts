import * as React from 'react'
import {
  createResourceController,
  type ResourceController,
  type ResourceControllerConfig,
  type ResourceState,
} from '@iris-ui/core'
import { useStore } from '../useStore'

export interface UseResourceController<T> extends ResourceController<T> {
  /** The live resource state (rows, total, page, loading, selectedKeys). */
  state: ResourceState<T>
}

/**
 * React bridge over the framework-agnostic {@link createResourceController} (L4
 * CRUD list composite). Creates the controller once, subscribes to its store,
 * and returns the controller plus its live `state`. A ~15-line thin bridge —
 * all logic lives in `@iris-ui/core`.
 */
export function useResourceController<T>(
  config: ResourceControllerConfig<T>,
): UseResourceController<T> {
  const ref = React.useRef<ResourceController<T> | null>(null)
  if (ref.current === null) ref.current = createResourceController(config)
  const controller = ref.current
  const state = useStore(controller.store)
  return React.useMemo(() => ({ ...controller, state }), [controller, state])
}
