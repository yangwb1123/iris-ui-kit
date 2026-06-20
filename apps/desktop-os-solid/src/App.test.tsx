import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render } from 'solid-js/web'
import { App } from './App'

// jsdom lacks ResizeObserver (App reserves the taskbar via one) — stub it.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
})

let container: HTMLDivElement
let dispose: () => void
afterEach(() => {
  dispose()
  container.remove()
})

function mount(): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  dispose = render(() => <App />, container)
}

describe('Iris Desktop OS (Solid) — shell', () => {
  it('mounts the desktop shell (hint, Start button, desktop icons)', () => {
    mount()
    expect(container.textContent).toContain('Iris Desktop OS')
    expect(container.querySelector('[aria-label="Start"]')).toBeTruthy()
    expect(container.querySelectorAll('.desktop-icon').length).toBeGreaterThan(0)
  })

  it('double-clicking a desktop icon opens a managed window', () => {
    mount()
    const aboutIcon = Array.from(container.querySelectorAll('.desktop-icon')).find((el) =>
      el.textContent?.includes('About'),
    )
    expect(aboutIcon).toBeTruthy()
    aboutIcon!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    // A title bar with the window title rendered — driven by createWindowManager.
    expect(container.querySelector('.win-titlebar')).toBeTruthy()
    expect(container.textContent).toContain('createWindowManager')
  })

  it('surfaces the App Store as a desktop icon (app-aggregation catalog)', () => {
    mount()
    const storeIcon = Array.from(container.querySelectorAll('.desktop-icon')).find((el) =>
      el.textContent?.includes('App Store'),
    )
    expect(storeIcon).toBeTruthy()
    storeIcon!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    // The App Store window lists installable + built-in apps from the catalog.
    expect(container.textContent).toContain('App Store')
    expect(container.textContent).toContain('Add a web app')
    expect(container.textContent).toContain('GitHub')
  })

  it('installs an app into the profile from the App Store', () => {
    mount()
    const storeIcon = Array.from(container.querySelectorAll('.desktop-icon')).find((el) =>
      el.textContent?.includes('App Store'),
    )!
    storeIcon.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    // Find the GitHub card's Install button and click it.
    const installBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Install',
    )
    expect(installBtn).toBeTruthy()
    installBtn!.click()
    // After install, that card offers Open + Uninstall (profile-driven re-render).
    expect(
      Array.from(container.querySelectorAll('button')).some(
        (b) => b.textContent?.trim() === 'Uninstall',
      ),
    ).toBe(true)
  })

  it('opens the ⌘K command palette and searches the registry', () => {
    mount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
    const dialog = container.querySelector('[aria-label="Command palette"]')
    expect(dialog).toBeTruthy()
    const search = container.querySelector(
      '[aria-label="Search commands"]',
    ) as HTMLInputElement | null
    expect(search).toBeTruthy()
    search!.value = 'App Store'
    search!.dispatchEvent(new Event('input', { bubbles: true }))
    // The registry surfaces the "Open App Store" command (Apps + System groups).
    expect(container.textContent).toContain('Open App Store')
  })
})
