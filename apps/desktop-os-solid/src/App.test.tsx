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
})
