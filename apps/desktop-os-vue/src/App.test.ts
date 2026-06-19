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
})
