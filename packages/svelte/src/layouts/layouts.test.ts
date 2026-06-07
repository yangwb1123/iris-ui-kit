import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import SidebarHarness from './SidebarHarness.svelte'
import HeaderHarness from './HeaderHarness.svelte'
import IrisStack from './Stack.svelte'
import IrisDashboardGrid from './DashboardGrid.svelte'
import IrisDashboardCard from './DashboardCard.svelte'

afterEach(cleanup)

describe('@iris-ui/svelte layouts', () => {
  it('IrisSidebarLayout renders sidebar (snippet) + main, controlled collapse', async () => {
    const onCollapsedChange = vi.fn()
    const { container } = render(SidebarHarness, { props: { collapsed: false, onCollapsedChange } })
    expect(container.querySelector('[data-iris-sidebar]')).not.toBeNull()
    expect(container.querySelector('[data-main]')?.textContent).toBe('content')
    await fireEvent.click(container.querySelector('[data-toggle]')!)
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
    // controlled: internal state must NOT flip on its own.
    expect(container.querySelector('[data-iris-sidebar][data-collapsed]')).toBeNull()
  })

  it('IrisSidebarLayout collapses uncontrolled + reflects data-collapsed', async () => {
    const { container } = render(SidebarHarness, { props: { defaultCollapsed: false } })
    expect(container.querySelector('[data-iris-sidebar][data-collapsed]')).toBeNull()
    await fireEvent.click(container.querySelector('[data-toggle]')!)
    expect(container.querySelector('[data-iris-sidebar][data-collapsed]')).not.toBeNull()
  })

  it('IrisHeaderLayout renders header / main / footer regions', () => {
    const { container } = render(HeaderHarness)
    expect(container.querySelector('[data-iris-header] [data-h]')).not.toBeNull()
    expect(container.querySelector('[data-iris-header-main] [data-c]')).not.toBeNull()
    expect(container.querySelector('[data-iris-footer] [data-f]')).not.toBeNull()
  })

  it('IrisStack applies direction + token gap', () => {
    const { container } = render(IrisStack, { props: { direction: 'row' } })
    const el = container.querySelector('[data-iris-stack]')!
    expect(el.getAttribute('data-iris-stack-direction')).toBe('row')
    expect(el.getAttribute('style') ?? '').toContain('gap')
  })

  it('IrisDashboardGrid + Card build grid styles', () => {
    const grid = render(IrisDashboardGrid, { props: { columns: 3 } })
    expect(
      grid.container.querySelector('[data-iris-dashboard-grid]')?.getAttribute('style') ?? '',
    ).toContain('repeat(3, 1fr)')
    const card = render(IrisDashboardCard, { props: { colSpan: 'full' } })
    expect(
      card.container.querySelector('[data-iris-dashboard-card]')?.getAttribute('style') ?? '',
    ).toContain('1 / -1')
  })
})
