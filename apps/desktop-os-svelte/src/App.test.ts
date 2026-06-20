import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import App from './App.svelte'
import { CATALOG, getManifest, BUILTIN_APPS, INSTALLABLE_APPS } from './catalog'
import { profile, getApps, addCustomApp } from './profile.svelte'
import { registry, buildDesktopCommands } from './commands.svelte'
import { wm } from './wm.svelte'

// jsdom lacks ResizeObserver (App reserves the taskbar via one) — stub it.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

let target: HTMLDivElement | undefined
let app: Record<string, unknown> | undefined

afterEach(() => {
  // Only the render()-based tests mount the app; the pure catalog/profile/command
  // tests don't, so guard the teardown to avoid a double-unmount.
  if (app) {
    unmount(app)
    app = undefined
  }
  target?.remove()
  target = undefined
})

function render(): HTMLDivElement {
  target = document.createElement('div')
  document.body.appendChild(target)
  app = mount(App, { target })
  flushSync()
  return target
}

describe('Iris Desktop OS — Svelte shell', () => {
  it('mounts the desktop shell (hint, Start button, desktop icons)', () => {
    const target = render()
    expect(target.textContent).toContain('Iris Desktop OS')
    expect(target.querySelector('[aria-label="Start"]')).toBeTruthy()
    expect(target.querySelectorAll('.desktop-icon').length).toBeGreaterThan(0)
  })

  it('double-clicking a desktop icon opens a managed window', () => {
    const target = render()
    const aboutIcon = Array.from(target.querySelectorAll('.desktop-icon')).find((el) =>
      el.textContent?.includes('About'),
    )!
    expect(aboutIcon).toBeTruthy()
    aboutIcon.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    flushSync()
    // A title bar with the window title rendered.
    expect(target.querySelector('.win-titlebar')).toBeTruthy()
    // The About window content (unique IrisBadge label) is now on screen.
    expect(target.textContent).toContain('createWindowManager')
  })

  it('Ctrl+K opens the command palette and Escape closes it', () => {
    const target = render()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    flushSync()
    expect(target.querySelector('[role="dialog"][aria-label="Command palette"]')).toBeTruthy()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    flushSync()
    expect(target.querySelector('[role="dialog"][aria-label="Command palette"]')).toBeNull()
  })
})

describe('App-aggregation catalog', () => {
  it('has builtin component apps and installable link/iframe apps', () => {
    expect(BUILTIN_APPS.length).toBeGreaterThan(0)
    expect(BUILTIN_APPS.every((a) => a.kind === 'component')).toBe(true)
    expect(INSTALLABLE_APPS.some((a) => a.kind === 'link')).toBe(true)
    expect(INSTALLABLE_APPS.some((a) => a.kind === 'iframe')).toBe(true)
    // App Store is a builtin component app.
    expect(getManifest('appstore')?.kind).toBe('component')
  })

  it('getManifest resolves catalog ids', () => {
    for (const m of CATALOG) expect(getManifest(m.id)).toBe(m)
    expect(getManifest('nope')).toBeUndefined()
  })
})

describe('Profile aggregation', () => {
  it('getApps = builtins + installed + custom; install/uninstall round-trips', () => {
    // Builtins always present.
    let apps = getApps(profile.getState())
    expect(apps.filter((a) => a.builtin).length).toBe(BUILTIN_APPS.length)

    // Installing a catalog link app surfaces it in the launchers.
    expect(profile.isInstalled('github')).toBe(false)
    profile.install('github')
    apps = getApps(profile.getState())
    expect(apps.some((a) => a.id === 'github')).toBe(true)
    profile.uninstall('github')
    apps = getApps(profile.getState())
    expect(apps.some((a) => a.id === 'github')).toBe(false)
  })

  it('addCustomApp aggregates a web app discoverable via getManifest', () => {
    const m = addCustomApp({ name: 'Example', url: 'https://example.com', kind: 'iframe' })
    profile.install(m.id)
    expect(m.custom).toBe(true)
    expect(m.kind).toBe('iframe')
    // Surfaced in the apps list AND resolvable by id (windows/taskbar/palette).
    expect(getApps(profile.getState()).some((a) => a.id === m.id)).toBe(true)
    expect(getManifest(m.id)?.name).toBe('Example')
    profile.uninstall(m.id)
  })
})

describe('Command registry aggregation', () => {
  it('builds Apps/Window/System commands; window commands gate on focus', () => {
    const commands = buildDesktopCommands(profile.getState(), wm.getState())
    expect(commands.some((c) => c.group === 'Apps')).toBe(true)
    expect(commands.some((c) => c.id === 'system:appstore')).toBe(true)
    const close = commands.find((c) => c.id === 'window:close')!
    // `enabled` tracks the live WM focus: false with no focused window, true once
    // a window is opened + focused.
    for (const w of wm.getState().windows) wm.close(w.id)
    expect(close.enabled?.()).toBe(false)
    const id = wm.open({ appId: 'about', title: 'About' })
    wm.focus(id)
    expect(close.enabled?.()).toBe(true)
    wm.close(id)
  })

  it('registered commands are fuzzy-searchable + runnable', () => {
    const unregister = registry.registerMany(
      buildDesktopCommands(profile.getState(), wm.getState()),
    )
    const hits = registry.search('app store')
    expect(hits.some((h) => h.command.id === 'system:appstore')).toBe(true)
    unregister()
  })
})
