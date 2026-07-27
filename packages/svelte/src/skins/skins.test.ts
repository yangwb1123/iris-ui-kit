import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { createSkinEngine } from '@iris-ui-kit/skins'
import SkinProvider from './SkinProvider.svelte'
import SkinHarness from './SkinHarness.svelte'
import type { UseSkinReturn } from './useSkin'

afterEach(cleanup)

describe('@iris-ui-kit/svelte skins', () => {
  it('applies the resolved skin vars to documentElement and reverts on unmount', () => {
    // memorySkinStorage-free engine — jsdom here has no window.localStorage.
    const engine = createSkinEngine({ skins: [], default: 'light' })
    const { unmount } = render(SkinProvider, { props: { engine } })
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBeTruthy()
    unmount()
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBe('')
  })

  it('provides the resolved skin and switches via setMode + setSkin', () => {
    const engine = createSkinEngine({ skins: [], default: 'light' })
    let api: UseSkinReturn | undefined
    const { container } = render(SkinHarness, {
      props: {
        engine,
        onready: (a: UseSkinReturn) => {
          api = a
        },
      },
    })
    expect(container.querySelector('[data-skin]')?.textContent).toBe('light')
    expect(api!.getActiveId()).toBe('light')
    api!.setMode('fixed')
    api!.setSkin('dark')
    flushSync()
    expect(container.querySelector('[data-skin]')?.textContent).toBe('dark')
  })
})
