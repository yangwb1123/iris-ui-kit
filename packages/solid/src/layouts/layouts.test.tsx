import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@solidjs/testing-library'
import { IrisSidebarLayout } from './SidebarLayout'
import { IrisHeaderLayout } from './HeaderLayout'

afterEach(cleanup)

describe('@iris-ui-kit/solid layouts', () => {
  it('IrisSidebarLayout renders sidebar (render-prop) + main, controlled collapse', () => {
    const onCollapsedChange = vi.fn()
    const { container } = render(() => (
      <IrisSidebarLayout
        collapsed={false}
        onCollapsedChange={onCollapsedChange}
        sidebar={(s) => (
          <button data-toggle="" onClick={() => s.setCollapsed(!s.collapsed)}>
            {s.collapsed ? 'expand' : 'collapse'}
          </button>
        )}
      >
        <div data-main="">content</div>
      </IrisSidebarLayout>
    ))
    expect(container.querySelector('[data-iris-sidebar]')).not.toBeNull()
    expect(container.querySelector('[data-main]')!.textContent).toBe('content')
    fireEvent.click(container.querySelector('[data-toggle]')!)
    expect(onCollapsedChange).toHaveBeenCalledWith(true)
  })

  it('IrisSidebarLayout collapses uncontrolled + reflects width via data-collapsed', () => {
    const { container } = render(() => (
      <IrisSidebarLayout
        defaultCollapsed={false}
        sidebar={(s) => <button data-toggle="" onClick={() => s.setCollapsed(true)} />}
      >
        x
      </IrisSidebarLayout>
    ))
    expect(container.querySelector('[data-iris-sidebar][data-collapsed]')).toBeNull()
    fireEvent.click(container.querySelector('[data-toggle]')!)
    expect(container.querySelector('[data-iris-sidebar][data-collapsed]')).not.toBeNull()
  })

  it('IrisHeaderLayout renders header / main / footer regions', () => {
    const { container } = render(() => (
      <IrisHeaderLayout header={<div data-h="">H</div>} footer={<div data-f="">F</div>}>
        <div data-c="">C</div>
      </IrisHeaderLayout>
    ))
    expect(container.querySelector('[data-iris-header] [data-h]')).not.toBeNull()
    expect(container.querySelector('[data-iris-header-main] [data-c]')).not.toBeNull()
    expect(container.querySelector('[data-iris-footer] [data-f]')).not.toBeNull()
  })
})
