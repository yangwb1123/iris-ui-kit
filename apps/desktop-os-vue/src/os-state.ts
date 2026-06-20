/**
 * OS-skin state — the Vue mirror of React's `useOs()` context. The current OS is
 * a persisted profile pref (`os`); reading it reactively means the whole shell
 * re-skins live when the user picks a new one (or when `hydrate()` lands a saved
 * choice on reload). `setOs` writes the pref (→ localStorage via the profile),
 * so the choice survives a reload — exactly the React shell's contract, adapted
 * to the shell's module-singleton profile (no provide/inject needed).
 */
import { computed, type ComputedRef } from 'vue'
import { CHROMES, OS_ORDER, type OsChrome, type OsId } from './os'
import { profile, useProfileState } from './profile'

/** The profile pref key under which the chosen OS skin is stored. */
const OS_PREF = 'os'

const isOsId = (v: unknown): v is OsId => OS_ORDER.includes(v as OsId)

export interface OsContextValue {
  /** The active OS id (reactive). */
  os: ComputedRef<OsId>
  /** The active chrome config (= CHROMES[os]) — the structural flags + skin vars. */
  chrome: ComputedRef<OsChrome>
  /** Switch the OS skin; persisted to the profile (`os` pref). */
  setOs: (id: OsId) => void
}

/**
 * Reactive access to the current OS skin + a setter. Reads the `os` pref from the
 * live profile state, falling back to 'win11' (and ignoring unknown values that
 * aren't in {@link OS_ORDER}). Shared singleton state via the profile.
 */
export function useOs(): OsContextValue {
  const state = useProfileState()
  const os = computed<OsId>(() => {
    const pref = state.value.prefs[OS_PREF]
    return isOsId(pref) ? pref : 'win11'
  })
  const chrome = computed<OsChrome>(() => CHROMES[os.value])
  const setOs = (id: OsId): void => profile.setPref(OS_PREF, id)
  return { os, chrome, setOs }
}
