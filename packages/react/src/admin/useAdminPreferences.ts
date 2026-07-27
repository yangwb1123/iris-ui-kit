import * as React from 'react'
import type { AdminPreferences, AdminPreferencesState } from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseAdminPreferencesReturn {
  state: AdminPreferencesState
  set: AdminPreferences['set']
  patch: AdminPreferences['patch']
  reset: AdminPreferences['reset']
  hydrate: AdminPreferences['hydrate']
  flush: AdminPreferences['flush']
}

/** Thin React bridge for the framework-agnostic admin preferences controller. */
export function useAdminPreferences(
  preferences: AdminPreferences,
  hydrate = true,
): UseAdminPreferencesReturn {
  const state = useStore(preferences.store)
  React.useEffect(() => {
    if (hydrate) void preferences.hydrate()
  }, [hydrate, preferences])
  return {
    state,
    set: preferences.set,
    patch: preferences.patch,
    reset: preferences.reset,
    hydrate: preferences.hydrate,
    flush: preferences.flush,
  }
}
