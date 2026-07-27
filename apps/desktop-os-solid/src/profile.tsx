import { createContext, createMemo, createSignal, onCleanup, useContext, type JSX } from 'solid-js'
import { type UserProfile, type ProfileData } from '@iris-ui-kit/core/profile'
import { type AppManifest, BUILTIN_APPS, getManifest, registerCustomApps } from './catalog'
import { useWm } from './wm'

/**
 * Solid glue around ONE `@iris-ui-kit/core/profile` instance — the framework-agnostic
 * USER PROFILE that holds which apps are installed plus user-added web apps. A
 * single profile lives in context (the SAME engine the React desktop drives,
 * here on Solid); the App Store mutates it and every launcher reads from it.
 */
const ProfileContext = createContext<UserProfile>()

export function ProfileProvider(props: {
  profile: UserProfile
  children: JSX.Element
}): JSX.Element {
  return <ProfileContext.Provider value={props.profile}>{props.children}</ProfileContext.Provider>
}

export function useProfile(): UserProfile {
  const profile = useContext(ProfileContext)
  if (!profile) throw new Error('useProfile must be used within <ProfileProvider>')
  return profile
}

/**
 * Subscribe to the live profile state as a Solid accessor. Mirrors the
 * window-manager bridge: seed from `getState()` (synchronous initial value),
 * then push every emission into a signal, unsubscribing on cleanup. Re-renders
 * when hydrate resolves OR the user installs / uninstalls / adds an app.
 */
export function useProfileState(): () => ProfileData {
  const profile = useProfile()
  const [state, setState] = createSignal(profile.getState())
  const unsubscribe = profile.subscribe((next) => setState(() => next))
  onCleanup(unsubscribe)
  return state
}

const CUSTOM_APPS_PREF = 'customApps'

/** Raw user-added web-app manifests from a profile snapshot (`customApps` pref). */
function readCustomApps(state: ProfileData): AppManifest[] {
  return (state.prefs[CUSTOM_APPS_PREF] as AppManifest[] | undefined) ?? []
}

/**
 * The apps to surface in launchers / desktop, as a reactive accessor: every
 * built-in app, plus the installed (non-builtin) catalog entries from the
 * profile, plus all user-added web apps (`customApps`). Re-derives whenever the
 * profile's installed list or custom apps change.
 *
 * Custom apps live in the profile (not the static catalog), so this also mirrors
 * them into the catalog's lookup registry — every shell component resolves apps
 * by id via `getManifest`, and that must find user-added apps too.
 */
export function useApps(): () => AppManifest[] {
  const state = useProfileState()
  return createMemo(() => {
    const snapshot = state()
    const customApps = readCustomApps(snapshot)
    // Keep `getManifest` able to resolve user-added apps (windows, icons, taskbar).
    registerCustomApps(customApps)
    const installed = snapshot.installed
      .map((a) => getManifest(a.appId))
      .filter((m): m is AppManifest => Boolean(m) && !m!.builtin && !m!.custom)
    return [...BUILTIN_APPS, ...installed, ...customApps]
  })
}

/**
 * Launch an app by id. `link` apps open in a new browser tab (no window);
 * everything else opens a managed window via the window manager.
 */
export function useLaunchApp(): (appId: string) => void {
  const wm = useWm()
  return (appId: string): void => {
    const app = getManifest(appId)
    if (!app) return
    if (app.kind === 'link' && app.url) {
      window.open(app.url, '_blank', 'noopener')
      return
    }
    wm.open({ appId: app.id, title: app.name, rect: app.defaultSize })
  }
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
 * Read + mutate USER-ADDED web apps stored in the profile (`customApps` pref).
 * Each is a portable {@link AppManifest} (kind `link`/`iframe`) flagged `custom`.
 * `list` is a reactive accessor so the App Store re-renders on add / remove.
 */
export function useCustomApps(): {
  list: () => AppManifest[]
  add: (input: AddCustomAppInput) => AppManifest
  remove: (id: string) => void
} {
  const profile = useProfile()
  const state = useProfileState()
  const list = createMemo(() => readCustomApps(state()))

  const add = (input: AddCustomAppInput): AppManifest => {
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
  }

  const remove = (id: string): void => {
    const current = profile.getPref<AppManifest[]>(CUSTOM_APPS_PREF) ?? []
    profile.setPref(
      CUSTOM_APPS_PREF,
      current.filter((m) => m.id !== id),
    )
    if (profile.isInstalled(id)) profile.uninstall(id)
  }

  return { list, add, remove }
}
