import * as React from 'react'
import {
  createGridSelectionFeature,
  type GridCore,
  type SelectionKey,
  type SelectionMode,
} from '@iris-ui-kit/core/grid'
import type { SelectionModel } from '@iris-ui-kit/core'
import { useStore } from '../useStore'
import { useGridFeature } from './useGridFeature'

function sameKeys<K extends SelectionKey>(left: readonly K[], right: readonly K[]): boolean {
  return left.length === right.length && left.every((key, index) => Object.is(key, right[index]))
}

export interface UseGridSelectionOptions<K extends SelectionKey = string> {
  mode?: SelectionMode
  value?: K[]
  defaultValue?: K[]
  onChange?: (keys: K[]) => void
  getKeys?: () => readonly K[]
}

export interface UseGridSelectionResult<K extends SelectionKey = string> {
  core: GridCore
  model: SelectionModel<K>
  selection: K[]
  controlled: boolean
  /** Rebase mutations on the latest controlled prop before applying them. */
  rebase(): void
}

/** Selection feature + React controlled/uncontrolled reactivity bridge. */
export function useGridSelection<
  Row extends Record<string, unknown> = Record<string, unknown>,
  K extends SelectionKey = string,
>(core: GridCore<Row>, options: UseGridSelectionOptions<K> = {}): UseGridSelectionResult<K> {
  const latest = React.useRef(options)
  latest.current = options

  const model = useGridFeature<Row, SelectionModel<K>>(core, 'selection', 'getSelectionModel', () =>
    createGridSelectionFeature<Row, K>({
      mode: options.mode,
      defaultSelected: options.value ?? options.defaultValue,
      getKeys: () => latest.current.getKeys?.() ?? [],
      onChange: (keys) => latest.current.onChange?.(keys),
    }),
  )
  const internalSelection = useStore(model.store)
  const controlled = options.value !== undefined

  React.useEffect(() => {
    if (controlled) {
      const next = options.value ?? []
      if (!sameKeys(model.get(), next)) model.sync(next)
    }
  }, [controlled, model, options.value])

  const rebase = React.useCallback(() => {
    if (latest.current.value !== undefined) model.sync(latest.current.value)
  }, [model])

  return {
    core,
    model,
    selection: controlled ? (options.value ?? []) : internalSelection,
    controlled,
    rebase,
  }
}
