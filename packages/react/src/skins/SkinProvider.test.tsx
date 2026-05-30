import { afterEach, describe, it, expect } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { createSkinEngine, type Skin } from '@iris-ui/skins'
import { SkinProvider } from './SkinProvider'
import { useSkin } from './useSkin'

afterEach(() => {
  cleanup()
  // Reset documentElement overrides left behind by previous tests.
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-iris-skin')
  document.documentElement.removeAttribute('data-iris-skin-type')
})

const brand: Skin = { id: 'brand', extends: 'dark', tokens: { 'iris.primary': '#abc' } }

function Probe() {
  const { skin, setSkin } = useSkin()
  return (
    <button onClick={() => setSkin('brand')} data-testid="b">
      {skin.id}:{skin.theme.colors['iris.primary']}
    </button>
  )
}

describe('SkinProvider / useSkin (React)', () => {
  it('provides the current skin and switches on setSkin', () => {
    const engine = createSkinEngine({ skins: [brand], default: 'light' })
    render(
      <SkinProvider engine={engine}>
        <Probe />
      </SkinProvider>,
    )
    expect(screen.getByTestId('b').textContent).toContain('light')
    act(() => {
      screen.getByTestId('b').click()
    })
    expect(screen.getByTestId('b').textContent).toContain('brand:#abc')
  })

  it('applies skin vars to documentElement and reverts on unmount', () => {
    const engine = createSkinEngine({ skins: [brand], default: 'brand' })
    const { unmount } = render(
      <SkinProvider engine={engine}>
        <span />
      </SkinProvider>,
    )
    expect(document.documentElement.getAttribute('data-iris-skin')).toBe('brand')
    unmount()
    expect(document.documentElement.getAttribute('data-iris-skin')).toBeNull()
  })
})
