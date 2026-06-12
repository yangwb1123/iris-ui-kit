import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import DrawerHarness from './DrawerHarness.svelte'
import SafeAreaDrawerHarness from './SafeAreaDrawerHarness.svelte'

afterEach(cleanup)

describe('IrisDrawer', () => {
  it('renders without crashing', () => {
    const { container } = render(DrawerHarness)
    expect(container).toBeTruthy()
  })

  it('content is hidden initially', () => {
    const { container } = render(DrawerHarness)
    expect(container.querySelector('[data-iris-drawer-content]')).toBeNull()
  })

  it('opens on trigger click', async () => {
    const { getByText } = render(DrawerHarness)
    await fireEvent.click(getByText('Open Drawer'))
    expect(document.querySelector('[data-iris-drawer-content]')).not.toBeNull()
  })

  it('closes on Close button click', async () => {
    const { getByText } = render(DrawerHarness)
    await fireEvent.click(getByText('Open Drawer'))
    await fireEvent.click(getByText('Close'))
    expect(document.querySelector('[data-iris-drawer-content]')).toBeNull()
  })

  it('bottom panel padding carries safe-area inset (mobile home-bar clearance)', () => {
    render(SafeAreaDrawerHarness, { props: { side: 'bottom' } })
    const panel = document.querySelector('[role=dialog]')!
    const style = panel.getAttribute('style') ?? ''
    expect(style).toContain('env(safe-area-inset-bottom')
  })

  it('left panel clamps full height to the dynamic viewport (100vh fallback + 100dvh)', () => {
    render(SafeAreaDrawerHarness, { props: { side: 'left' } })
    const panel = document.querySelector('[role=dialog]')!
    const style = panel.getAttribute('style') ?? ''
    expect(style).toContain('height: 100vh')
    expect(style).toContain('max-height: 100dvh')
  })
})
