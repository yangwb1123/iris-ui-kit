import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisDashboardTemplate } from './IrisDashboardTemplate'
import { IrisLoginTemplate } from './IrisLoginTemplate'

afterEach(cleanup)

describe('IrisDashboardTemplate', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisDashboardTemplate />)
    expect(container.querySelector('[data-iris-dashboard-template]')).not.toBeNull()
  })

  it('renders nav items', () => {
    const nav = [
      { id: 'home', label: 'Home' },
      { id: 'settings', label: 'Settings' },
    ]
    const { container } = render(() => <IrisDashboardTemplate nav={nav} />)
    expect(container.querySelector('[data-iris-dashboard-nav-item="home"]')).not.toBeNull()
    expect(container.querySelector('[data-iris-dashboard-nav-item="settings"]')).not.toBeNull()
  })
})

describe('IrisLoginTemplate', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisLoginTemplate />)
    expect(container.querySelector('[data-iris-login-template]')).not.toBeNull()
  })

  it('renders email and password fields', () => {
    const { container } = render(() => <IrisLoginTemplate />)
    expect(container.querySelector('[data-iris-login-template-email]')).not.toBeNull()
    expect(container.querySelector('[data-iris-login-template-password]')).not.toBeNull()
  })

  it('renders submit button', () => {
    const { container } = render(() => <IrisLoginTemplate submitLabel="Log in" />)
    const btn = container.querySelector('[data-iris-login-template-submit]') as HTMLButtonElement
    expect(btn.textContent).toBe('Log in')
  })
})
