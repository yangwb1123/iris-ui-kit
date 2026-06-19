import * as React from 'react'
import { type AppManifest, type Permission } from './catalog'
import { useProfile, useProfileState } from './shell'

/**
 * App PERMISSIONS model for the Iris Desktop OS. Each {@link AppManifest} may
 * request a set of {@link Permission}s; the desktop surfaces them transparently
 * (App Store badges) and lets the user grant/revoke them per app (Settings →
 * Privacy & permissions). Grants persist in the user profile under the
 * `grants` pref (`Record<appId, Permission[]>`). Enforcement is advisory for
 * this demo — the explicit, user-visible contract is the point.
 *
 * This module also models USER-ADDED web apps: any external service the user
 * aggregates by URL, stored in the profile under the `customApps` pref so they
 * appear across every launcher (see {@link useCustomApps}).
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
 * Read + mutate the per-app permission grants stored in the profile. Subscribes
 * to profile state so callers re-render when grants change.
 */
export function useGrants() {
  const profile = useProfile()
  // Subscribe so grant/revoke re-renders consumers.
  useProfileState()

  const grants = (profile.getPref<GrantsMap>(GRANTS_PREF) ?? {}) as GrantsMap

  const isGranted = React.useCallback(
    (appId: string, perm: Permission): boolean => {
      const map = profile.getPref<GrantsMap>(GRANTS_PREF) ?? {}
      return (map[appId] ?? []).includes(perm)
    },
    [profile],
  )

  const grant = React.useCallback(
    (appId: string, perm: Permission): void => {
      const map = { ...(profile.getPref<GrantsMap>(GRANTS_PREF) ?? {}) }
      const current = map[appId] ?? []
      if (current.includes(perm)) return
      map[appId] = [...current, perm]
      profile.setPref(GRANTS_PREF, map)
    },
    [profile],
  )

  const revoke = React.useCallback(
    (appId: string, perm: Permission): void => {
      const map = { ...(profile.getPref<GrantsMap>(GRANTS_PREF) ?? {}) }
      const current = map[appId] ?? []
      if (!current.includes(perm)) return
      map[appId] = current.filter((p) => p !== perm)
      profile.setPref(GRANTS_PREF, map)
    },
    [profile],
  )

  const grantAll = React.useCallback(
    (appId: string, perms: Permission[]): void => {
      const map = { ...(profile.getPref<GrantsMap>(GRANTS_PREF) ?? {}) }
      const current = map[appId] ?? []
      const next = [...current]
      for (const p of perms) if (!next.includes(p)) next.push(p)
      map[appId] = next
      profile.setPref(GRANTS_PREF, map)
    },
    [profile],
  )

  return { grants, isGranted, grant, revoke, grantAll }
}

const CUSTOM_APPS_PREF = 'customApps'

/** Input for adding a user web app. */
export interface AddCustomAppInput {
  name: string
  url: string
  kind: 'link' | 'iframe'
  /** Optional emoji glyph; falls back to a sensible default per kind. */
  icon?: string
}

/** Generate a stable-ish unique id for a user-added app. */
function makeCustomId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Read + mutate USER-ADDED web apps stored in the profile (`customApps` pref).
 * Each is a portable {@link AppManifest} (kind `link`/`iframe`) flagged `custom`
 * and requesting the `network` permission. Subscribes to profile state.
 */
export function useCustomApps() {
  const profile = useProfile()
  useProfileState()

  const list = (profile.getPref<AppManifest[]>(CUSTOM_APPS_PREF) ?? []) as AppManifest[]

  const add = React.useCallback(
    (input: AddCustomAppInput): AppManifest => {
      const name = input.name.trim()
      const url = input.url.trim()
      const manifest: AppManifest = {
        id: makeCustomId(),
        name: name || url,
        icon: input.icon?.trim() || (input.kind === 'iframe' ? '🪟' : '🔗'),
        kind: input.kind,
        url,
        description:
          input.kind === 'iframe' ? `Embeds ${url} in a window.` : `Opens ${url} in a new tab.`,
        permissions: ['network'],
        custom: true,
        defaultSize: input.kind === 'iframe' ? { width: 640, height: 480 } : undefined,
      }
      const current = profile.getPref<AppManifest[]>(CUSTOM_APPS_PREF) ?? []
      profile.setPref(CUSTOM_APPS_PREF, [...current, manifest])
      return manifest
    },
    [profile],
  )

  const remove = React.useCallback(
    (id: string): void => {
      const current = profile.getPref<AppManifest[]>(CUSTOM_APPS_PREF) ?? []
      profile.setPref(
        CUSTOM_APPS_PREF,
        current.filter((m) => m.id !== id),
      )
      // Drop any grants + install record for the removed app.
      const grants = { ...(profile.getPref<GrantsMap>(GRANTS_PREF) ?? {}) }
      if (grants[id]) {
        delete grants[id]
        profile.setPref(GRANTS_PREF, grants)
      }
      if (profile.isInstalled(id)) profile.uninstall(id)
    },
    [profile],
  )

  return { list, add, remove }
}
