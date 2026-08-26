import * as React from 'react'
import {
  createGridExpansionFeature,
  type ExpansionMode,
  type ExpansionModel,
  type GridCore,
  type GridExpansionKey,
} from '@iris-ui-kit/core/grid'
import { useStore } from '../useStore'
import { useGridFeature } from './useGridFeature'

export interface UseGridExpansionOptions<K extends GridExpansionKey = string> {
  mode?: ExpansionMode
  defaultValue?: K[]
  onChange?: (keys: K[]) => void
  getKeys?: () => readonly K[]
}

export interface UseGridExpansionResult<K extends GridExpansionKey = string> {
  core: GridCore
  model: ExpansionModel<K>
  expandedKeys: K[]
}

/** Installs one expansion feature and bridges its store into React. */
export function useGridExpansion<
  Row extends Record<string, unknown> = Record<string, unknown>,
  K extends GridExpansionKey = string,
>(core: GridCore<Row>, options: UseGridExpansionOptions<K> = {}): UseGridExpansionResult<K> {
  const latest = React.useRef(options)
  latest.current = options

  const model = useGridFeature<Row, ExpansionModel<K>>(core, 'expansion', 'getExpansionModel', () =>
    createGridExpansionFeature<Row, K>({
      mode: options.mode,
      defaultExpanded: options.defaultValue,
      getKeys: () => latest.current.getKeys?.() ?? [],
      onChange: (keys) => latest.current.onChange?.(keys),
    }),
  )
  const expandedKeys = useStore(model.store)

  return { core, model, expandedKeys }
}
