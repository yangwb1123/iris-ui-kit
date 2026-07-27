import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import DrawerHarness from './DrawerHarness.svelte'
import SafeAreaDrawerHarness from './SafeAreaDrawerHarness.svelte'
import EscapeDrawerHarness from './EscapeDrawerHarness.svelte'
import DrawerAsChildHarness from './DrawerAsChildHarness.svelte'

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

  it('wires aria-labelledby to the mounted title', async () => {
    const { getByText } = render(DrawerHarness)
    await fireEvent.click(getByText('Open Drawer'))
    const content = document.querySelector('[role="dialog"]')!
    const title = document.querySelector('[data-iris-drawer-title]')!
    expect(content.getAttribute('aria-labelledby')).toBe(title.id)
  })

  it('closes on Close button click', async () => {
    const { getByText } = render(DrawerHarness)
    await fireEvent.click(getByText('Open Drawer'))
    await fireEvent.click(getByText('Close'))
    expect(document.querySelector('[data-iris-drawer-content]')).toBeNull()
  })

  it('closes on Escape key when closeOnEscape is enabled', async () => {
    render(EscapeDrawerHarness)
    expect(document.querySelector('[data-iris-drawer-content]')).not.toBeNull()
    await fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-iris-drawer-content]')).toBeNull()
  })

  it('stays open on Escape key when closeOnEscape is false', async () => {
    render(EscapeDrawerHarness, { props: { closeOnEscape: false } })
    expect(document.querySelector('[data-iris-drawer-content]')).not.toBeNull()
    await fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-iris-drawer-content]')).not.toBeNull()
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

  it('asChild trigger keeps rest attrs, emits no wrapper, and opens', async () => {
    const { container, getByText } = render(DrawerAsChildHarness)
    const trigger = getByText('Open custom drawer')
    expect(container.querySelectorAll('button')).toHaveLength(1)
    expect(trigger.id).toBe('drawer-trigger')
    expect(trigger.getAttribute('data-trigger-rest')).toBe('kept')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')

    await fireEvent.click(trigger)
    expect(document.querySelector('[data-iris-drawer-content]')).not.toBeNull()
  })

  it('asChild close keeps rest attrs, emits no wrapper, and closes', async () => {
    const { getByText } = render(DrawerAsChildHarness)
    await fireEvent.click(getByText('Open custom drawer'))
    const close = getByText('Close custom drawer')
    expect(close.id).toBe('drawer-close')
    expect(close.getAttribute('data-close-rest')).toBe('kept')
    expect(close.getAttribute('data-iris-drawer-close')).not.toBeNull()

    await fireEvent.click(close)
    expect(document.querySelector('[data-iris-drawer-content]')).toBeNull()
  })
})
