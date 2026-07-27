import { onMount } from 'svelte'
import type { Readable } from 'svelte/store'
import type { AdminPreferences, AdminPreferencesState } from '@iris-ui-kit/core'
import { toStore } from '../useStore'

export interface UseAdminPreferencesReturn {
  state: Readable<AdminPreferencesState>
  set: AdminPreferences['set']
  patch: AdminPreferences['patch']
  reset: AdminPreferences['reset']
  hydrate: AdminPreferences['hydrate']
  flush: AdminPreferences['flush']
}

/** Thin Svelte bridge for the framework-agnostic admin preferences controller. */
export function useAdminPreferences(
  preferences: AdminPreferences,
  hydrate = true,
): UseAdminPreferencesReturn {
  const state = toStore(preferences.store)
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
