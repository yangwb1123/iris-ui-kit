import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { App } from './App'

// jsdom lacks ResizeObserver (App reserves the taskbar via one) — stub it.
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

let container: HTMLDivElement
let root: Root
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(<App />)
  })
}

describe('Iris Desktop OS — shell', () => {
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
    )!
    expect(aboutIcon).toBeTruthy()
    act(() => {
      aboutIcon.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    // The About window content (unique IrisBadge label) is now on screen.
    expect(container.textContent).toContain('createWindowManager')
    // A title bar with the window title rendered.
    expect(container.querySelector('.win-titlebar')).toBeTruthy()
  })
})
