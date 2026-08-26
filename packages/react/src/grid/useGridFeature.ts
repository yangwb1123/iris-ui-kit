import * as React from 'react'
import type { GridCore, GridFeature } from '@iris-ui-kit/core/grid'

/** Install one feature once per Grid Core bridge and return its model. */
export function useGridFeature<Row extends Record<string, unknown>, Model>(
  core: GridCore<Row>,
  name: string,
  modelMethod: string,
  create: () => GridFeature<Row>,
): Model {
  const feature = React.useRef<GridFeature<Row> | null>(null)
  if (feature.current === null) feature.current = create()
  if (!core.hasFeature(name)) core.use(feature.current)
  return core.invoke<Model>(modelMethod)
}
