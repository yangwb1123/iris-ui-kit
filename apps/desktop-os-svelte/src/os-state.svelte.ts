/**
 * The ONE OS-skin store for this desktop shell — a rune-based module singleton,
 * the Svelte counterpart of React's `useOs()` (the `OsContext` in
 * `apps/desktop-os/src/shell.tsx`). It picks the active {@link OsChrome} (the
 * skin + structural flags the shell branches on) and persists the choice to the
 * user profile under the `os` pref, so it survives a reload — the same pattern as
 * the persisted accent color (see `appviews/Settings.svelte`).
 *
 * Svelte gotcha — `$state`/`$effect` live in `.svelte` / `.svelte.ts` modules,
 * and a `$state` variable must NOT be named `state` (reserved-ish footgun); the
 * profile snapshot is read directly here, so there's no such binding to trip on.
 */
import { CHROMES, OS_ORDER, type OsChrome, type OsId } from './os'
import { profile } from './profile.svelte'

/** Profile pref holding the chosen OS skin id. */
const OS_PREF = 'os'
/** Default skin when none is saved (or the saved value is unknown). */
const DEFAULT_OS: OsId = 'win11'

const isOsId = (v: unknown): v is OsId => OS_ORDER.includes(v as OsId)

/** Read the saved skin from the profile, falling back to {@link DEFAULT_OS}. */
function readOs(): OsId {
  const saved = profile.getPref<string>(OS_PREF)
  return isOsId(saved) ? saved : DEFAULT_OS
}

// The live OS id. Seeded from the profile synchronously (localStorage is sync),
// then kept in sync with the profile store so a hydrated/updated `os` pref — or
// a `setOs` from anywhere in the shell — re-skins every reader live.
let osId = $state<OsId>(readOs())
profile.subscribe(() => {
  const next = readOs()
  if (next !== osId) osId = next
})

export interface OsContextValue {
  /** The active OS id (`win11` | `macos` | `kde`). */
  readonly os: OsId
  /** The active chrome (skin vars + structural flags) for {@link os}. */
  readonly chrome: OsChrome
  /** Switch the OS skin; persists to the profile (→ localStorage). */
  setOs: (id: OsId) => void
}

/**
 * Access the live OS skin: current `os` / `chrome` (reactive getters) + `setOs`.
 * Read `.os` / `.chrome` in markup / `$derived` to stay live; call `setOs` to
 * switch (which re-skins every reader and persists the choice).
 */
export function useOs(): OsContextValue {
  return {
    get os() {
      return osId
    },
    get chrome() {
      return CHROMES[osId]
    },
    setOs(id: OsId) {
      // Persist to the profile; the store subscription above flips `osId`, which
      // re-skins every reader. Update the rune eagerly too so a synchronous read
      // right after `setOs` already sees the new value (storage write is async-ish).
      osId = id
      profile.setPref(OS_PREF, id)
    },
  }
}
