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
})
