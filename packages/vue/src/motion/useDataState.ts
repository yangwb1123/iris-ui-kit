import { computed, onMounted, type ComputedRef } from 'vue'
import { resolveDataState, type DataState, type DataStateInput } from '@iris-ui/core'
import { DATA_STATE_CLASS, installDataStateStyles } from './styles'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface DataStateNodeProps {
  class: string
  'data-iris-state': DataState
}

export interface UseDataStateReturn {
  /** Resolved state (`error → loading → empty → content` precedence). */
  state: ComputedRef<DataState>
  /** `true` when the host should render its real content. */
  isContent: ComputedRef<boolean>
  /** Use as the vnode `key` of the state node so the enter animation replays on each transition. */
  stateKey: ComputedRef<DataState>
  /** Spread onto the rendered loading/error/empty node. */
  stateProps: ComputedRef<DataStateNodeProps>
}

/**
 * State-transition + entry-animation composable for data components. Resolves
 * the active {@link DataState} from a reactive `{ loading, error, empty }`
 * getter, and returns props for the state node that (a) re-key on every
 * transition so the cross-fade replays and (b) drop the animation class when
 * the user prefers reduced motion.
 *
 * The framework-agnostic precedence lives in `@iris-ui/core`'s
 * {@link resolveDataState}; this composable is the thin Vue animation bridge.
 */
export function useDataState(input: () => DataStateInput): UseDataStateReturn {
  onMounted(installDataStateStyles)
  const reduced = usePrefersReducedMotion()
  const state = computed(() => resolveDataState(input()))
  return {
    state,
    isContent: computed(() => state.value === 'content'),
    stateKey: state,
    stateProps: computed(() => ({
      class: reduced.value ? '' : DATA_STATE_CLASS,
      'data-iris-state': state.value,
    })),
  }
}
