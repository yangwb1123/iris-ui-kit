/**
 * The seam that proves `@iris-ui-kit/core/profile` is framework-agnostic: ONE
 * `createUserProfile()` instance, shared across the whole Vue shell via a module
 * singleton (mirrors React's `useRef(createUserProfile()).current`), plus Vue
 * composables that bridge its core store into a `ref`.
 *
 * The profile holds which apps a user has installed and global prefs, persisted
 * to localStorage. `hydrate()` (async) runs once on mount — the desktop renders
 * immediately and state updates when it lands.
 */
import { computed, shallowRef, type ComputedRef, type Ref } from 'vue'
import {
  createUserProfile,
  localStorageProfileStorage,
  type ProfileData,
  type UserProfile,
} from '@iris-ui-kit/core/profile'
import {
  BUILTIN_APPS,
  getManifest,
  registerCustomApps,
  type AppManifest,
  type Permission,
} from './catalog'
import { wm } from './wm'

/** The single, app-wide user profile — persisted to this device. */
export const profile: UserProfile = createUserProfile({
  storage: localStorageProfileStorage('iris-desktop-os-vue'),
})

// ONE module-level subscription bridges the core store into a Vue ref. Every
// consumer shares it (no per-component subscribe), matching the wm.ts pattern.
const profileState = shallowRef<ProfileData>(profile.getState())
profile.subscribe((next) => (profileState.value = next))

/** The shared user profile instance. */
export function useProfile(): UserProfile {
  return profile
}

/** Reactive, read-only view of the live profile state (installed apps + prefs). */
export function useProfileState(): Ref<ProfileData> {
  return profileState
}

const CUSTOM_APPS_PREF = 'customApps'

/** Raw user-added web-app manifests from the profile (`customApps` pref). */
function readCustomApps(state: ProfileData): AppManifest[] {
  return (state.prefs[CUSTOM_APPS_PREF] as AppManifest[] | undefined) ?? []
}

/**
 * The apps to surface in launchers / desktop: every built-in app, plus the
 * installed (non-builtin) catalog entries from the profile, plus all user-added
 * web apps (`customApps`) so they appear in every launcher. Re-derives whenever
 * the profile's installed list or custom apps change.
 *
 * Custom apps live in the profile (not the static catalog), so this also mirrors
 * them into the catalog's lookup registry — every shell component resolves apps
 * by id via `getManifest`, and that must find user-added apps too.
 */
export function useApps(): ComputedRef<AppManifest[]> {
  return computed(() => {
    const state = profileState.value
    const customApps = readCustomApps(state)
    // Keep `getManifest` able to resolve user-added apps (windows, icons, taskbar).
    registerCustomApps(customApps)
    const installed = state.installed
      .map((a) => getManifest(a.appId))
      .filter((m): m is AppManifest => Boolean(m) && !m!.builtin && !m!.custom)
    return [...BUILTIN_APPS, ...installed, ...customApps]
  })
}

/**
 * Launch an app by id. `link` apps open in a new browser tab (no window);
 * everything else opens a managed window via the window manager.
 */
export function launchApp(appId: string): void {
  const app = getManifest(appId)
  if (!app) return
  if (app.kind === 'link' && app.url) {
    window.open(app.url, '_blank', 'noopener')
    return
  }
  wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
}

// ── User-added web apps ────────────────────────────────────────────────────

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

/** The live list of user-added web apps (reactive). */
export function useCustomApps(): ComputedRef<AppManifest[]> {
  return computed(() => readCustomApps(profileState.value))
}

/**
 * Add a USER web app: build a portable {@link AppManifest} (kind `link`/`iframe`)
 * flagged `custom`, store it in the profile (`customApps` pref), and return it.
 */
export function addCustomApp(input: AddCustomAppInput): AppManifest {
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
  const current = readCustomApps(profile.getState())
  profile.setPref(CUSTOM_APPS_PREF, [...current, manifest])
  return manifest
}

const GRANTS_PREF = 'grants'

/** Remove a user-added web app (also drops its install record + permission grants). */
export function removeCustomApp(id: string): void {
  const current = readCustomApps(profile.getState())
  profile.setPref(
    CUSTOM_APPS_PREF,
    current.filter((m) => m.id !== id),
  )
  // Drop any permission grants recorded for the removed app.
  const grants = {
    ...((profile.getState().prefs[GRANTS_PREF] as Record<string, Permission[]> | undefined) ?? {}),
  }
  if (grants[id]) {
    delete grants[id]
    profile.setPref(GRANTS_PREF, grants)
  }
  if (profile.isInstalled(id)) profile.uninstall(id)
}
