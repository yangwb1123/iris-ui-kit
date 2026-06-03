import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { createSkinEngine } from '@iris-ui/skins'
import { SkinProvider, useSkin } from './index'

afterEach(cleanup)

describe('@iris-ui/solid skins', () => {
  it('provides the resolved skin, applies it, and switches via setSkin', () => {
    // memorySkinStorage-free engine — jsdom here has no window.localStorage.
    const engine = createSkinEngine({ skins: [], default: 'light' })
    let api!: ReturnType<typeof useSkin>
    const Probe = () => {
      api = useSkin()
      return <div data-skin="">{api.skin().id}</div>
    }
    const { container } = render(() => (
      <SkinProvider engine={engine}>
        <Probe />
      </SkinProvider>
    ))

    expect(container.querySelector('[data-skin]')!.textContent).toBe('light')
    expect(api.getActiveId()).toBe('light')
    expect(document.documentElement.style.getPropertyValue('--iris-background')).toBeTruthy()

    api.setMode('fixed')
    api.setSkin('dark')
    expect(container.querySelector('[data-skin]')!.textContent).toBe('dark')
  })
})
