import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import DrawerHarness from './DrawerHarness.svelte'

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
})
