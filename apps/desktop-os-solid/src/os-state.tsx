import { createContext, createMemo, useContext, type JSX } from 'solid-js'
import { CHROMES, OS_ORDER, type OsChrome, type OsId } from './os'
import { useProfile, useProfileState } from './profile'

/**
 * The OS-skin seam, Solid-side. Mirrors the React shell's `useOs()` ({ chrome,
 * setOs }) but exposes the current `os` as a reactive accessor and persists the
 * choice to the user profile under the `os` pref — read on startup, default
 * `win11`, re-skins LIVE on change because every consumer reads `chrome()`.
 *
 * One window manager, multiple OS chromes: this context is the ONLY thing that
 * changes when you switch skins; the WM, windows and command registry are
 * untouched.
 */
export interface OsContextValue {
  /** Current OS id (reactive). */
  os: () => OsId
  /** Current chrome config for `os()` (reactive). */
  chrome: () => OsChrome
  /** Switch the skin; persists to the profile (`os` pref). */
  setOs: (id: OsId) => void
}

const OsContext = createContext<OsContextValue>()

/** Profile pref key the chosen OS skin persists under. */
const OS_PREF = 'os'

const isOsId = (v: unknown): v is OsId => OS_ORDER.includes(v as OsId)

/**
 * Provides the live OS-skin state. Reads the persisted `os` pref reactively (so a
 * hydrated/updated value re-skins), defaults to `win11`, and writes the choice
 * back to the profile via {@link setOs}.
 */
export function OsProvider(props: { children: JSX.Element }): JSX.Element {
  const profile = useProfile()
  const state = useProfileState()

  const os = createMemo<OsId>(() => {
    const pref = state().prefs[OS_PREF]
    return isOsId(pref) ? pref : 'win11'
  })
  const chrome = createMemo<OsChrome>(() => CHROMES[os()])
  const setOs = (id: OsId): void => profile.setPref(OS_PREF, id)

  return <OsContext.Provider value={{ os, chrome, setOs }}>{props.children}</OsContext.Provider>
}

/** The live OS-skin state. Throws outside an {@link OsProvider}. */
export function useOs(): OsContextValue {
  const ctx = useContext(OsContext)
  if (!ctx) throw new Error('useOs must be used within <OsProvider>')
  return ctx
}
