import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import App from './App.svelte'

// jsdom lacks ResizeObserver (App reserves the taskbar via one) — stub it.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

let target: HTMLDivElement
let app: Record<string, unknown>

afterEach(() => {
  unmount(app)
  target.remove()
})

function render() {
  target = document.createElement('div')
  document.body.appendChild(target)
  app = mount(App, { target })
  flushSync()
}

describe('Iris Desktop OS — Svelte shell', () => {
  it('mounts the desktop shell (hint, Start button, desktop icons)', () => {
    render()
    expect(target.textContent).toContain('Iris Desktop OS')
    expect(target.querySelector('[aria-label="Start"]')).toBeTruthy()
    expect(target.querySelectorAll('.desktop-icon').length).toBeGreaterThan(0)
  })

  it('double-clicking a desktop icon opens a managed window', () => {
    render()
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
})
