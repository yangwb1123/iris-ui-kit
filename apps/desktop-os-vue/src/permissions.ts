/**
 * App PERMISSIONS model for the Iris Desktop OS (Vue). Each {@link AppManifest}
 * may request a set of {@link Permission}s; the desktop surfaces them
 * transparently (App Store badges) and lets the user grant/revoke them per app
 * (Settings → Privacy & permissions). Grants persist in the user profile under
 * the `grants` pref (`Record<appId, Permission[]>`). Enforcement is advisory for
 * this demo — the explicit, user-visible contract is the point. The Vue twin of
 * the React demo's `permissions.ts`.
 *
 * USER-ADDED web apps (aggregated by URL) live in the shell's `./profile`
 * (`useCustomApps` / `addCustomApp`); this module only owns the grant model.
 */
import { type Permission } from './catalog'
import { useProfile, useProfileState } from './profile'

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
 * Read + mutate the per-app permission grants stored in the profile. Reads go
 * through the reactive profile state (so `isGranted` re-evaluates in templates
 * when grants change); writes go through the live profile instance.
 */
export function useGrants() {
  const profile = useProfile()
  // Reactive profile state — read here so consumers re-render when grants change.
  const profileState = useProfileState()

  const readMap = (): GrantsMap =>
    (profileState.value.prefs[GRANTS_PREF] as GrantsMap | undefined) ?? {}

  /** Whether `appId` has been granted `perm` (reactive). */
  const isGranted = (appId: string, perm: Permission): boolean =>
    (readMap()[appId] ?? []).includes(perm)

  /** Grant `perm` to `appId` (no-op if already granted). */
  const grant = (appId: string, perm: Permission): void => {
    const map = { ...readMap() }
    const current = map[appId] ?? []
    if (current.includes(perm)) return
    map[appId] = [...current, perm]
    profile.setPref(GRANTS_PREF, map)
  }

  /** Revoke `perm` from `appId` (no-op if not granted). */
  const revoke = (appId: string, perm: Permission): void => {
    const map = { ...readMap() }
    const current = map[appId] ?? []
    if (!current.includes(perm)) return
    map[appId] = current.filter((p) => p !== perm)
    profile.setPref(GRANTS_PREF, map)
  }

  /** Grant every permission in `perms` to `appId` (idempotent). */
  const grantAll = (appId: string, perms: Permission[]): void => {
    const map = { ...readMap() }
    const next = [...(map[appId] ?? [])]
    for (const p of perms) if (!next.includes(p)) next.push(p)
    map[appId] = next
    profile.setPref(GRANTS_PREF, map)
  }

  return { isGranted, grant, revoke, grantAll }
}
