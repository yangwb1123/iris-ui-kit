import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisSidebarLayout } from './SidebarLayout'
import { IrisHeaderLayout } from './HeaderLayout'
import { IrisDashboardGrid, IrisDashboardCard } from './DashboardGrid'

afterEach(() => cleanup())

describe('@iris-ui/react IrisSidebarLayout', () => {
  it('renders root + sidebar (complementary) + main', () => {
    const { container } = render(
      <IrisSidebarLayout sidebar={<nav>nav</nav>}>
        <div>main</div>
      </IrisSidebarLayout>,
    )
    expect(container.querySelector('[data-iris-sidebar-layout]')).not.toBeNull()
    expect(container.querySelector('aside[role=complementary]')).not.toBeNull()
    expect(container.querySelector('[data-iris-sidebar-main]')).not.toBeNull()
  })

  it('sidebar width reflects expanded vs collapsed', () => {
    const { container, rerender } = render(
      <IrisSidebarLayout collapsed={false} width={200} collapsedWidth={50} sidebar={<nav />} />,
    )
    let aside = container.querySelector('aside') as HTMLElement
    expect(aside.style.width).toBe('200px')
    rerender(
      <IrisSidebarLayout collapsed={true} width={200} collapsedWidth={50} sidebar={<nav />} />,
    )
    aside = container.querySelector('aside') as HTMLElement
    expect(aside.style.width).toBe('50px')
  })

  it('emits onCollapsedChange from the render-function sidebar', () => {
    const onChange = vi.fn()
    const { container } = render(
      <IrisSidebarLayout
        defaultCollapsed={false}
        onCollapsedChange={onChange}
        sidebar={({ collapsed, setCollapsed }) => (
          <button type="button" onClick={() => setCollapsed(!collapsed)}>
            toggle
          </button>
        )}
      />,
    )
    act(() => {
      fireEvent.click(container.querySelector('button')!)
    })
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('side="right" reverses flex direction', () => {
    const { container } = render(
      <IrisSidebarLayout side="right" sidebar={<nav />} />,
    )
    const root = container.querySelector('[data-iris-sidebar-layout]') as HTMLElement
    expect(root.style.flexDirection).toBe('row-reverse')
    expect(root.getAttribute('data-side')).toBe('right')
  })

  it('CSS length width passes through verbatim', () => {
    const { container } = render(
      <IrisSidebarLayout width="20rem" collapsedWidth="3rem" sidebar={<nav />} />,
    )
    expect((container.querySelector('aside') as HTMLElement).style.width).toBe('20rem')
  })
})

describe('@iris-ui/react IrisHeaderLayout', () => {
  it('renders main region; header and footer only when provided', () => {
    const { container } = render(
      <IrisHeaderLayout>
        <p>content</p>
      </IrisHeaderLayout>,
    )
    expect(container.querySelector('main[role=main]')).not.toBeNull()
    expect(container.querySelector('header[role=banner]')).toBeNull()
    expect(container.querySelector('footer[role=contentinfo]')).toBeNull()
  })

  it('renders header + footer when provided', () => {
    const { container } = render(
      <IrisHeaderLayout header={<div>H</div>} footer={<div>F</div>}>
        <div>M</div>
      </IrisHeaderLayout>,
    )
    expect(container.querySelector('header[role=banner]')).not.toBeNull()
    expect(container.querySelector('footer[role=contentinfo]')).not.toBeNull()
  })

  it('headerHeight numeric becomes px', () => {
    const { container } = render(
      <IrisHeaderLayout headerHeight={56} header={<div />}>
        <div />
      </IrisHeaderLayout>,
    )
    expect((container.querySelector('header') as HTMLElement).style.height).toBe('56px')
  })

  it('sticky=true puts position:sticky on header', () => {
    const { container } = render(
      <IrisHeaderLayout sticky header={<div />}>
        <div />
      </IrisHeaderLayout>,
    )
    expect((container.querySelector('header') as HTMLElement).style.position).toBe('sticky')
  })

  it('sticky=false uses static positioning', () => {
    const { container } = render(
      <IrisHeaderLayout sticky={false} header={<div />}>
        <div />
      </IrisHeaderLayout>,
    )
    expect((container.querySelector('header') as HTMLElement).style.position).toBe('static')
  })
})

describe('@iris-ui/react IrisDashboardGrid', () => {
  it('renders with fixed columns by default', () => {
    const { container } = render(
      <IrisDashboardGrid>
        <div>a</div>
      </IrisDashboardGrid>,
    )
    const el = container.querySelector('[data-iris-dashboard-grid]') as HTMLElement
    expect(el.style.display).toBe('grid')
    expect(el.style.gridTemplateColumns).toBe('repeat(12, 1fr)')
  })

  it('columns prop overrides', () => {
    const { container } = render(
      <IrisDashboardGrid columns={4}>
        <div />
      </IrisDashboardGrid>,
    )
    expect(
      (container.querySelector('[data-iris-dashboard-grid]') as HTMLElement).style
        .gridTemplateColumns,
    ).toBe('repeat(4, 1fr)')
  })

  it('minColWidth switches to auto-fill mode', () => {
    const { container } = render(
      <IrisDashboardGrid minColWidth={240}>
        <div />
      </IrisDashboardGrid>,
    )
    expect(
      (container.querySelector('[data-iris-dashboard-grid]') as HTMLElement).style
        .gridTemplateColumns,
    ).toBe('repeat(auto-fill, minmax(240px, 1fr))')
  })

  it('numeric gap becomes px', () => {
    const { container } = render(
      <IrisDashboardGrid gap={20}>
        <div />
      </IrisDashboardGrid>,
    )
    expect(
      (container.querySelector('[data-iris-dashboard-grid]') as HTMLElement).style.gap,
    ).toBe('20px')
  })

  it('DashboardCard colSpan="full" sets 1 / -1', () => {
    const { container } = render(
      <IrisDashboardGrid>
        <IrisDashboardCard colSpan="full">x</IrisDashboardCard>
      </IrisDashboardGrid>,
    )
    expect(
      (container.querySelector('[data-iris-dashboard-card]') as HTMLElement).style.gridColumn,
    ).toBe('1 / -1')
  })

  it('DashboardCard integer colSpan uses span N', () => {
    const { container } = render(
      <IrisDashboardGrid>
        <IrisDashboardCard colSpan={4}>x</IrisDashboardCard>
      </IrisDashboardGrid>,
    )
    expect(
      (container.querySelector('[data-iris-dashboard-card]') as HTMLElement).style.gridColumn,
    ).toBe('span 4')
  })

  it('DashboardCard surface=false removes border/background', () => {
    const { container } = render(
      <IrisDashboardGrid>
        <IrisDashboardCard surface={false}>x</IrisDashboardCard>
      </IrisDashboardGrid>,
    )
    const card = container.querySelector('[data-iris-dashboard-card]') as HTMLElement
    expect(card.style.background).toBe('transparent')
    // jsdom normalizes `border: none` to empty string
    expect(['none', '']).toContain(card.style.border)
  })
})
