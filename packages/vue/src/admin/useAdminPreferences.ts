import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue'
import type { AdminPreferences, AdminPreferencesState } from '@iris-ui-kit/core'

export interface UseAdminPreferencesReturn {
  state: ComputedRef<AdminPreferencesState>
  set: AdminPreferences['set']
  patch: AdminPreferences['patch']
  reset: AdminPreferences['reset']
  hydrate: AdminPreferences['hydrate']
  flush: AdminPreferences['flush']
}

/** Thin Vue bridge for the framework-agnostic admin preferences controller. */
export function useAdminPreferences(
  preferences: AdminPreferences,
  hydrate = true,
): UseAdminPreferencesReturn {
  const state = ref(preferences.getState()) as Ref<AdminPreferencesState>
  const unsubscribe = preferences.subscribe((next) => {
    state.value = next
  })
  onMounted(() => {
    if (hydrate) void preferences.hydrate()
  })
  onBeforeUnmount(unsubscribe)
  return {
    state: computed(() => state.value),
    set: preferences.set,
    patch: preferences.patch,
    reset: preferences.reset,
    hydrate: preferences.hydrate,
    flush: preferences.flush,
  }
}
