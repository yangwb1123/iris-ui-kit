import { createMemo } from 'solid-js'
import { type Permission } from './catalog'
import { useProfile, useProfileState } from './profile'

/**
 * App PERMISSIONS model for the Iris Desktop OS (Solid shell). Each app manifest
 * may request a set of {@link Permission}s; the desktop surfaces them
 * transparently (App Store badges) and lets the user grant/revoke them per app
 * (Settings → Privacy & permissions). Grants persist in the user profile under
 * the `grants` pref (`Record<appId, Permission[]>`). Enforcement is advisory for
 * this demo — the explicit, user-visible contract is the point. This mirrors the
 * React desktop's `permissions.ts`, here on Solid (user-added web apps live in
 * the profile too; see `useCustomApps` in `./profile`).
 */

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
 * Read + mutate the per-app permission grants stored in the profile. `grants` is
 * a reactive Solid accessor (re-derived from live profile state) so consumers
 * re-render when grants change; the mutators read straight from the profile.
 */
export function useGrants(): {
  grants: () => GrantsMap
  isGranted: (appId: string, perm: Permission) => boolean
  grant: (appId: string, perm: Permission) => void
  revoke: (appId: string, perm: Permission) => void
  grantAll: (appId: string, perms: Permission[]) => void
} {
  const profile = useProfile()
  // Subscribe so grant/revoke re-renders consumers.
  const state = useProfileState()
  const grants = createMemo<GrantsMap>(
    () => (state().prefs[GRANTS_PREF] as GrantsMap | undefined) ?? {},
  )

  const isGranted = (appId: string, perm: Permission): boolean => {
    const map = profile.getPref<GrantsMap>(GRANTS_PREF) ?? {}
    return (map[appId] ?? []).includes(perm)
  }

  const grant = (appId: string, perm: Permission): void => {
    const map = { ...(profile.getPref<GrantsMap>(GRANTS_PREF) ?? {}) }
    const current = map[appId] ?? []
    if (current.includes(perm)) return
    map[appId] = [...current, perm]
    profile.setPref(GRANTS_PREF, map)
  }

  const revoke = (appId: string, perm: Permission): void => {
    const map = { ...(profile.getPref<GrantsMap>(GRANTS_PREF) ?? {}) }
    const current = map[appId] ?? []
    if (!current.includes(perm)) return
    map[appId] = current.filter((p) => p !== perm)
    profile.setPref(GRANTS_PREF, map)
  }

  const grantAll = (appId: string, perms: Permission[]): void => {
    const map = { ...(profile.getPref<GrantsMap>(GRANTS_PREF) ?? {}) }
    const current = map[appId] ?? []
    const next = [...current]
    for (const p of perms) if (!next.includes(p)) next.push(p)
    map[appId] = next
    profile.setPref(GRANTS_PREF, map)
  }

  return { grants, isGranted, grant, revoke, grantAll }
}
