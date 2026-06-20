import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createApp, nextTick, type App as VueApp } from 'vue'
import App from './App.vue'

// jsdom lacks ResizeObserver (App reserves the taskbar via one) — stub it.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

let container: HTMLDivElement
let app: VueApp

afterEach(() => {
  app?.unmount()
  container?.remove()
})

function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  app = createApp(App)
  app.mount(container)
}

describe('Iris Desktop OS (Vue) — shell', () => {
  it('mounts the desktop shell (hint, Start button, desktop icons)', () => {
    mount()
    expect(container.textContent).toContain('Iris Desktop OS')
    expect(container.querySelector('[aria-label="Start"]')).toBeTruthy()
    expect(container.querySelectorAll('.desktop-icon').length).toBeGreaterThan(0)
  })

  it('double-clicking a desktop icon opens a managed window', async () => {
    mount()
    const aboutIcon = Array.from(container.querySelectorAll('.desktop-icon')).find((el) =>
      el.textContent?.includes('About'),
    )
    expect(aboutIcon).toBeTruthy()
    aboutIcon!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await nextTick()
    // The About window content (unique IrisBadge label) is now on screen.
    expect(container.textContent).toContain('createWindowManager')
    // A title bar with the window title rendered.
    expect(container.querySelector('.win-titlebar')).toBeTruthy()
  })

  it('opens the App Store (app-aggregation layer) from its desktop icon', async () => {
    mount()
    const storeIcon = Array.from(container.querySelectorAll('.desktop-icon')).find((el) =>
      el.textContent?.includes('App Store'),
    )
    expect(storeIcon).toBeTruthy()
    storeIcon!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await nextTick()
    // The store renders its catalog sections + add-a-web-app form.
    expect(container.textContent).toContain('Add a web app')
    expect(container.textContent).toContain('Built-in')
  })

  it('(Ctrl|Meta)+K toggles the command palette with Open-app commands', async () => {
    mount()
    expect(container.querySelector('[aria-label="Command palette"]')).toBeFalsy()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    await nextTick()
    const palette = container.querySelector('[aria-label="Command palette"]')
    expect(palette).toBeTruthy()
    // Apps register "Open {name}" commands into the shared registry.
    expect(palette!.textContent).toContain('Open About')
    expect(palette!.textContent).toContain('Open App Store')
    // Esc closes it.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(container.querySelector('[aria-label="Command palette"]')).toBeFalsy()
  })

  it('right-clicking the desktop opens the context menu with skin switchers', async () => {
    mount()
    expect(container.querySelector('[role="menu"]')).toBeFalsy()
    const desktop = container.querySelector('.desktop')!
    desktop.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }),
    )
    await nextTick()
    const menu = container.querySelector('[role="menu"]')
    expect(menu).toBeTruthy()
    // One "Use {skin}" per OS, plus the Display settings / Refresh actions.
    expect(menu!.textContent).toContain('Use Windows 11')
    expect(menu!.textContent).toContain('Use macOS')
    expect(menu!.textContent).toContain('Use KDE Plasma')
    expect(menu!.textContent).toContain('Display settings')
    expect(menu!.querySelector('[role="separator"]')).toBeTruthy()
    // Escape dismisses it.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(container.querySelector('[role="menu"]')).toBeFalsy()
  })

  it('clicking a context-menu item switches the OS skin and closes the menu', async () => {
    mount()
    const desktop = container.querySelector('.desktop')!
    desktop.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }),
    )
    await nextTick()
    const macItem = Array.from(container.querySelectorAll('[role="menuitem"]')).find((el) =>
      el.textContent?.includes('Use macOS'),
    )
    expect(macItem).toBeTruthy()
    macItem!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    // Menu closes after a selection.
    expect(container.querySelector('[role="menu"]')).toBeFalsy()
    // The skin switched: the macOS dock is now the bottom bar.
    expect(container.querySelector('.dock')).toBeTruthy()
  })
})
