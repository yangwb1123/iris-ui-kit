import { createMemo, onMount, type Accessor } from 'solid-js'
import { resolveDataState, type DataState, type DataStateInput } from '@iris-ui/core'
import { DATA_STATE_CLASS, installDataStateStyles } from './styles'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface DataStateNodeProps {
  class: string
  'data-iris-state': DataState
}

export interface UseDataStateReturn {
  state: Accessor<DataState>
  isContent: Accessor<boolean>
  stateKey: Accessor<DataState>
  stateProps: Accessor<DataStateNodeProps>
}

/**
 * State-transition + entry-animation composable for data components.
 * Solid port of the Vue useDataState.
 */
export function useDataState(input: () => DataStateInput): UseDataStateReturn {
  onMount(installDataStateStyles)
  const reduced = usePrefersReducedMotion()
  const state = createMemo(() => resolveDataState(input()))

  return {
    state,
    isContent: createMemo(() => state() === 'content'),
    stateKey: state,
    stateProps: createMemo(() => ({
      class: reduced() ? '' : DATA_STATE_CLASS,
      'data-iris-state': state(),
    })),
  }
}
