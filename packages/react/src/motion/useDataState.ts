import * as React from 'react'
import { resolveDataState, type DataState, type DataStateInput } from '@iris-ui/core'
import { DATA_STATE_CLASS, installDataStateStyles } from './styles'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface DataStateNodeProps {
  className: string
  'data-iris-state': DataState
}

export interface UseDataStateReturn {
  /** Resolved state (`error → loading → empty → content` precedence). */
  state: DataState
  /** `true` when the host should render its real content. */
  isContent: boolean
  /** Use as the React `key` of the state node so the enter animation replays on each transition. */
  stateKey: DataState
  /** Spread onto the rendered loading/error/empty node. */
  stateProps: DataStateNodeProps
}

/**
 * State-transition + entry-animation hook for data components. Resolves the
 * active {@link DataState} from `{ loading, error, empty }`, and returns props
 * for the state node that (a) re-key on every transition so the cross-fade
 * replays and (b) drop the animation class when the user prefers reduced motion.
 *
 * The framework-agnostic precedence lives in `@iris-ui/core`'s
 * {@link resolveDataState}; this hook is the thin React animation bridge.
 */
export function useDataState(input: DataStateInput): UseDataStateReturn {
  React.useEffect(installDataStateStyles, [])
  const reduced = usePrefersReducedMotion()
  const state = resolveDataState(input)
  return {
    state,
    isContent: state === 'content',
    stateKey: state,
    stateProps: {
      className: reduced ? '' : DATA_STATE_CLASS,
      'data-iris-state': state,
    },
  }
}
