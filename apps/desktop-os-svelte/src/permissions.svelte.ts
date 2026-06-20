/**
 * App PERMISSIONS model for the Iris Desktop OS (Svelte 5 shell). Each
 * {@link AppManifest} may request a set of {@link Permission}s; the desktop
 * surfaces them transparently (App Store badges) and lets the user grant/revoke
 * them per app (Settings → Privacy & permissions). Grants persist in the user
 * profile under the `grants` pref (`Record<appId, Permission[]>`). Enforcement is
 * advisory for this demo — the explicit, user-visible contract is the point.
 *
 * Mirrors `apps/desktop-os/src/permissions.ts` (React), adapted to Svelte 5:
 * React's `useGrants` hook becomes a `useGrants()` that bridges the same core
 * profile store into runes via the shell's `useProfileState` (so consumers stay
 * live as grants change), exposing the same `isGranted/grant/revoke/grantAll` API.
 * User-added web apps stay in `profile.svelte.ts` (`addCustomApp`); this module
 * does not duplicate that.
 */
import type { Permission } from './catalog'
import { profile, useProfileState } from './profile.svelte'

/** Human-facing metadata for each permission (label + description + emoji icon). */
export const PERMISSION_META: Record<
  Permission,
  { label: string; description: string; icon: string }
> = {
  storage: {
    label: 'Storage',
    description: 'Read and write data in your profile (persisted to this device).',
    icon: '💾',
  },
  clipboard: {
    label: 'Clipboard',
    description: 'Read from and write to the system clipboard.',
    icon: '📋',
  },
  notifications: {
    label: 'Notifications',
    description: 'Post desktop notifications.',
    icon: '🔔',
  },
  network: {
    label: 'Network',
    description: 'Make external network requests or embed remote content.',
    icon: '🌐',
  },
  agent: {
    label: 'AI agent',
    description: 'Drive the in-app AI agent on your behalf.',
    icon: '🤖',
  },
}

/** Stable order for rendering permission lists. */
export const ALL_PERMISSIONS: Permission[] = [
  'storage',
  'clipboard',
  'notifications',
  'network',
  'agent',
]

const GRANTS_PREF = 'grants'
type GrantsMap = Record<string, Permission[]>

/**
 * Read + mutate the per-app permission grants stored in the profile. Call inside
 * a component: it bridges profile state into runes via {@link useProfileState}
 * (registers an `$effect`) so callers re-render when grants change. Mutators read
 * the live pref before writing, so they're safe regardless of the snapshot.
 */
export function useGrants() {
  // Subscribe so grant/revoke re-renders consumers (read `.value` in a $derived).
  const pstate = useProfileState()

  function readMap(): GrantsMap {
    return (profile.getPref<GrantsMap>(GRANTS_PREF) ?? {}) as GrantsMap
  }

  function isGranted(appId: string, perm: Permission): boolean {
    // Touch the reactive snapshot so callers re-derive after a grant/revoke.
    void pstate.value
    return (readMap()[appId] ?? []).includes(perm)
  }

  function grant(appId: string, perm: Permission): void {
    const map = { ...readMap() }
    const current = map[appId] ?? []
    if (current.includes(perm)) return
    map[appId] = [...current, perm]
    profile.setPref(GRANTS_PREF, map)
  }

  function revoke(appId: string, perm: Permission): void {
    const map = { ...readMap() }
    const current = map[appId] ?? []
    if (!current.includes(perm)) return
    map[appId] = current.filter((p) => p !== perm)
    profile.setPref(GRANTS_PREF, map)
  }

  function grantAll(appId: string, perms: Permission[]): void {
    const map = { ...readMap() }
    const next = [...(map[appId] ?? [])]
    for (const p of perms) if (!next.includes(p)) next.push(p)
    map[appId] = next
    profile.setPref(GRANTS_PREF, map)
  }

  return {
    /** Live snapshot of the grants map (read in markup/`$derived` to stay reactive). */
    get grants(): GrantsMap {
      void pstate.value
      return readMap()
    },
    isGranted,
    grant,
    revoke,
    grantAll,
  }
}
