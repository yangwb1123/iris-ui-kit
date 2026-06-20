/**
 * The ONE user profile for this desktop shell — a module singleton over the
 * framework-agnostic `@iris-ui/core/profile` (`createUserProfile`). It holds
 * which apps the user has installed, their custom web apps, and global prefs;
 * persistence is `localStorageProfileStorage` (this device). The SAME engine the
 * React demo drives, proving it runs unchanged on Svelte 5.
 *
 * Svelte gotcha — `$state`/`$derived`/`$effect` only work in `.svelte` /
 * `.svelte.ts` modules, and a `$state` variable must NOT be named `state`
 * (reserved-ish footgun); we use `pstate`.
 */
import {
  createUserProfile,
  localStorageProfileStorage,
  type UserProfile,
  type ProfileData,
} from '@iris-ui/core/profile'
import { type AppManifest, BUILTIN_APPS, getManifest, registerCustomApps } from './catalog'
import { wm } from './wm.svelte'

/** One profile for the whole shell, persisted to localStorage. */
export const profile: UserProfile = createUserProfile({
  storage: localStorageProfileStorage('iris-desktop-os-svelte'),
})

const CUSTOM_APPS_PREF = 'customApps'

/**
 * Bridge the core profile store into Svelte runes: a reactive snapshot of the
 * profile state (installed apps + prefs). Call inside a component (it registers
 * an `$effect`); read the returned `.value` in markup/`$derived` to stay live.
 */
export function useProfileState(): { readonly value: ProfileData } {
  let pstate = $state<ProfileData>(profile.getState())
  $effect(() => profile.subscribe((v) => (pstate = v)))
  return {
    get value() {
      return pstate
    },
  }
}

/** Read the user-added web-app manifests stored in the profile. */
export function readCustomApps(state: ProfileData): AppManifest[] {
  return (state.prefs[CUSTOM_APPS_PREF] as AppManifest[] | undefined) ?? []
}

/**
 * The apps to surface in launchers / desktop FROM a profile snapshot: every
 * built-in app, plus the installed (non-builtin) catalog entries, plus all
 * user-added web apps so they appear in every launcher.
 *
 * Custom apps live in the profile (not the static catalog), so this also mirrors
 * them into the catalog's lookup registry — every shell component resolves apps
 * by id via `getManifest`, and that must find user-added apps too.
 */
export function getApps(state: ProfileData): AppManifest[] {
  const customApps = readCustomApps(state)
  // Keep `getManifest` able to resolve user-added apps (windows, icons, taskbar).
  registerCustomApps(customApps)
  const installed = state.installed
    .map((a) => getManifest(a.appId))
    .filter((m): m is AppManifest => m !== undefined && !m.builtin && !m.custom)
  return [...BUILTIN_APPS, ...installed, ...customApps]
}

/**
 * Launch an app by id. `link` apps open in a new browser tab (no window);
 * everything else (component + iframe) opens a managed window via the WM.
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
 * Add a USER web app: a portable {@link AppManifest} (kind `link`/`iframe`)
 * flagged `custom`, stored in the profile under `customApps`. Returns it so the
 * caller can `install` it (so it shows across every launcher immediately).
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
    custom: true,
    defaultSize: input.kind === 'iframe' ? { width: 640, height: 480 } : undefined,
  }
  const current = profile.getPref<AppManifest[]>(CUSTOM_APPS_PREF) ?? []
  profile.setPref(CUSTOM_APPS_PREF, [...current, manifest])
  return manifest
}

/** Remove a user-added app (drops it from `customApps` + any install record). */
export function removeCustomApp(id: string): void {
  const current = profile.getPref<AppManifest[]>(CUSTOM_APPS_PREF) ?? []
  profile.setPref(
    CUSTOM_APPS_PREF,
    current.filter((m) => m.id !== id),
  )
  if (profile.isInstalled(id)) profile.uninstall(id)
}
