import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisLoginTemplate } from './LoginTemplate'
import { IrisDashboardTemplate } from './DashboardTemplate'

afterEach(() => cleanup())

describe('@iris-ui-kit/react IrisLoginTemplate', () => {
  it('renders title + 2 inputs + submit button', () => {
    render(<IrisLoginTemplate title="Welcome back" />)
    expect(document.querySelector('h1')?.textContent).toBe('Welcome back')
    expect(document.querySelectorAll('input').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('button[type=submit]')).not.toBeNull()
  })

  it('shows description when provided', () => {
    render(<IrisLoginTemplate description="Sign in to your workspace." />)
    expect(document.querySelector('p')?.textContent).toBe('Sign in to your workspace.')
  })

  it('omits remember-me when showRemember=false', () => {
    render(<IrisLoginTemplate showRemember={false} />)
    expect(document.body.textContent).not.toMatch(/Remember me/)
  })

  it('renders danger alert when error is set', () => {
    render(<IrisLoginTemplate error="Wrong password" />)
    expect(document.body.textContent).toMatch(/Wrong password/)
  })

  it('submitting calls onSubmit with payload', () => {
    const onSubmit = vi.fn()
    render(<IrisLoginTemplate onSubmit={onSubmit} />)
    const [email, password] = document.querySelectorAll('input') as unknown as HTMLInputElement[]
    act(() => {
      fireEvent.change(email!, { target: { value: 'a@b.com' } })
      fireEvent.change(password!, { target: { value: 'secret' } })
    })
    act(() => {
      fireEvent.submit(document.querySelector('form')!)
    })
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret',
      remember: false,
    })
  })

  it('loading disables submit button', () => {
    render(<IrisLoginTemplate loading />)
    expect((document.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('submit label customizable', () => {
    render(<IrisLoginTemplate submitLabel="Continue" />)
    expect(document.querySelector('button[type=submit]')?.textContent).toContain('Continue')
  })

  it('custom header replaces title block', () => {
    render(<IrisLoginTemplate header={<div data-testid="custom-h">Custom</div>} />)
    expect(document.querySelector('[data-testid=custom-h]')).not.toBeNull()
    // Default h1 should be gone.
    expect(document.querySelector('h1')).toBeNull()
  })
})

describe('@iris-ui-kit/react IrisDashboardTemplate', () => {
  it('renders sidebar (complementary) + header + main', () => {
    render(
      <IrisDashboardTemplate
        title="My App"
        nav={[
          { id: 'home', label: 'Home' },
          { id: 'settings', label: 'Settings' },
        ]}
        activeId="home"
        cards={[{ id: 'a', title: 'Card A', body: 'A body' }]}
      />,
    )
    expect(document.querySelector('[data-iris-dashboard-template]')).not.toBeNull()
    expect(document.querySelector('[data-iris-sidebar]')).not.toBeNull()
    expect(document.querySelector('header')?.textContent).toContain('My App')
  })

  it('nav items render with active state', () => {
    render(
      <IrisDashboardTemplate
        nav={[
          { id: 'home', label: 'Home' },
          { id: 'about', label: 'About' },
        ]}
        activeId="about"
      />,
    )
    const items = document.querySelectorAll('[data-iris-dashboard-nav-item]')
    expect(items.length).toBe(2)
    const active = document.querySelector('[data-iris-dashboard-nav-active=true]')
    expect(active?.getAttribute('data-iris-dashboard-nav-item')).toBe('about')
  })

  it('clicking a nav item fires onActiveIdChange', () => {
    const onChange = vi.fn()
    render(
      <IrisDashboardTemplate
        nav={[
          { id: 'home', label: 'Home' },
          { id: 'about', label: 'About' },
        ]}
        activeId="home"
        onActiveIdChange={onChange}
      />,
    )
    act(() => {
      fireEvent.click(document.querySelector('[data-iris-dashboard-nav-item=about]')!)
    })
    expect(onChange).toHaveBeenCalledWith('about')
  })

  it('cards render in the grid with default 4-column span', () => {
    render(
      <IrisDashboardTemplate
        cards={[
          { id: 'a', title: 'A' },
          { id: 'b', title: 'B' },
        ]}
      />,
    )
    const cards = document.querySelectorAll('[data-iris-dashboard-card-id]')
    expect(cards.length).toBe(2)
  })

  it('defaultCollapsed=false leaves sidebar expanded', () => {
    render(<IrisDashboardTemplate />)
    expect(document.querySelector('[data-iris-sidebar]')?.getAttribute('data-collapsed')).toBeNull()
  })

  it('defaultCollapsed=true flips the sidebar to collapsed', () => {
    render(<IrisDashboardTemplate defaultCollapsed />)
    expect(document.querySelector('[data-iris-sidebar]')?.getAttribute('data-collapsed')).toBe('')
  })

  it('cardSlots override card body', () => {
    render(
      <IrisDashboardTemplate
        cards={[{ id: 'a', title: 'A', body: 'default body' }]}
        cardSlots={{ a: <span data-testid="custom-body">overridden</span> }}
      />,
    )
    expect(document.querySelector('[data-testid=custom-body]')?.textContent).toBe('overridden')
  })

  it('children replaces the grid', () => {
    render(
      <IrisDashboardTemplate>
        <div data-testid="custom-main">my main</div>
      </IrisDashboardTemplate>,
    )
    expect(document.querySelector('[data-testid=custom-main]')).not.toBeNull()
    expect(document.querySelector('[data-iris-dashboard-grid]')).toBeNull()
  })
})
