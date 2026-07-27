import { readable, derived, type Readable } from 'svelte/store'
import { onMount } from 'svelte'
import { resolveDataState, type DataState, type DataStateInput } from '@iris-ui-kit/core'
import { installDataStateStyles, DATA_STATE_CLASS } from './styles'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface UseDataStateReturn {
  state: Readable<DataState>
  isContent: Readable<boolean>
  stateClass: Readable<string>
}

/**
 * Svelte binding for data-state transitions.
 * Pass a getter returning { loading, error, empty }.
 * Returns Svelte stores for reactive use in templates.
 */
export function useDataState(input: () => DataStateInput): UseDataStateReturn {
  onMount(installDataStateStyles)
  const reduced = usePrefersReducedMotion()

  const state = readable<DataState>(resolveDataState(input()), (set) => {
    // Re-evaluate whenever the store is used — the initial value covers static usage
    set(resolveDataState(input()))
  })

  return {
    state,
    isContent: derived(state, ($s) => $s === 'content'),
    stateClass: derived([state, reduced], ([, $r]) => ($r ? '' : DATA_STATE_CLASS)),
  }
}
