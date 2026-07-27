import { onMount, type Accessor } from 'solid-js'
import type { AdminPreferences, AdminPreferencesState } from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseAdminPreferencesReturn {
  state: Accessor<AdminPreferencesState>
  set: AdminPreferences['set']
  patch: AdminPreferences['patch']
  reset: AdminPreferences['reset']
  hydrate: AdminPreferences['hydrate']
  flush: AdminPreferences['flush']
}

/** Thin Solid bridge for the framework-agnostic admin preferences controller. */
export function useAdminPreferences(
  preferences: AdminPreferences,
  hydrate = true,
): UseAdminPreferencesReturn {
  const state = useStore(preferences.store)
  onMount(() => {
    if (hydrate) void preferences.hydrate()
  })
  return {
    state,
    set: preferences.set,
    patch: preferences.patch,
    reset: preferences.reset,
    hydrate: preferences.hydrate,
    flush: preferences.flush,
  }
}
