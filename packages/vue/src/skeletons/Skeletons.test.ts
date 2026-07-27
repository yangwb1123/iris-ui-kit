import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisLoginTemplate } from './LoginTemplate'
import { IrisDashboardTemplate } from './DashboardTemplate'

afterEach(() => {})

describe('@iris-ui-kit/vue IrisLoginTemplate', () => {
  it('renders title + email + password inputs + submit button', () => {
    const wrap = mount(IrisLoginTemplate, {
      props: { title: 'Welcome back' },
    })
    expect(wrap.find('h1').text()).toBe('Welcome back')
    const inputs = wrap.findAll('input')
    // 1 email + 1 password (the password field's textbox) + 1 toggle button input
    expect(inputs.length).toBeGreaterThanOrEqual(2)
    expect(wrap.find('button[type=submit]').exists()).toBe(true)
  })

  it('shows description when provided', () => {
    const wrap = mount(IrisLoginTemplate, {
      props: { description: 'Sign in to your workspace.' },
    })
    expect(wrap.find('p').text()).toBe('Sign in to your workspace.')
  })

  it('omits remember-me when showRemember=false', () => {
    const wrap = mount(IrisLoginTemplate, {
      props: { showRemember: false },
    })
    // No "Remember me" text rendered.
    expect(wrap.html()).not.toMatch(/Remember me/)
  })

  it('renders error alert when error prop is set', () => {
    const wrap = mount(IrisLoginTemplate, {
      props: { error: 'Wrong password' },
    })
    expect(wrap.html()).toMatch(/Wrong password/)
  })

  it('submitting emits payload with email + password + remember', async () => {
    const wrap = mount(IrisLoginTemplate, {
      attachTo: document.body,
    })
    const inputs = wrap.findAll('input')
    const emailEl = inputs[0]!.element as HTMLInputElement
    const passwordEl = inputs[1]!.element as HTMLInputElement
    emailEl.value = 'a@b.com'
    passwordEl.value = 'secret'
    await inputs[0]!.trigger('input')
    await inputs[1]!.trigger('input')
    await wrap.find('form').trigger('submit')
    const emit = wrap.emitted('submit')!
    expect(emit.length).toBe(1)
    const payload = emit[0]![0] as { email: string; password: string; remember: boolean }
    expect(payload.email).toBe('a@b.com')
    expect(payload.password).toBe('secret')
    expect(payload.remember).toBe(false)
    wrap.unmount()
  })

  it('loading disables the submit button', () => {
    const wrap = mount(IrisLoginTemplate, { props: { loading: true } })
    const btn = wrap.find('button[type=submit]').element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('customSubmitLabel reflects', () => {
    const wrap = mount(IrisLoginTemplate, {
      props: { submitLabel: 'Continue' },
    })
    expect(wrap.find('button[type=submit]').text()).toContain('Continue')
  })
})

describe('@iris-ui-kit/vue IrisDashboardTemplate', () => {
  it('renders header + sidebar + main grid', () => {
    const wrap = mount(IrisDashboardTemplate, {
      props: {
        title: 'My App',
        nav: [
          { id: 'home', label: 'Home' },
          { id: 'settings', label: 'Settings' },
        ],
        activeId: 'home',
        cards: [
          { id: 'a', title: 'Card A', body: 'A body' },
          { id: 'b', title: 'Card B', body: 'B body', colSpan: 8 },
        ],
      },
    })
    expect(wrap.find('[data-iris-dashboard-template]').exists()).toBe(true)
    expect(wrap.find('[data-iris-sidebar]').exists()).toBe(true)
    expect(wrap.find('header').text()).toContain('My App')
  })

  it('nav buttons render with active state', () => {
    const wrap = mount(IrisDashboardTemplate, {
      props: {
        nav: [
          { id: 'home', label: 'Home' },
          { id: 'about', label: 'About' },
        ],
        activeId: 'about',
      },
    })
    const items = wrap.findAll('[data-iris-dashboard-nav-item]')
    expect(items.length).toBe(2)
    const active = wrap.find('[data-iris-dashboard-nav-active=true]')
    expect(active.attributes('data-iris-dashboard-nav-item')).toBe('about')
  })

  it('clicking a nav item emits update:activeId', async () => {
    const wrap = mount(IrisDashboardTemplate, {
      props: {
        nav: [
          { id: 'home', label: 'Home' },
          { id: 'about', label: 'About' },
        ],
        activeId: 'home',
      },
    })
    await wrap.find('[data-iris-dashboard-nav-item=about]').trigger('click')
    const emit = wrap.emitted('update:activeId')!
    expect(emit[0]![0]).toBe('about')
  })

  it('cards render in the grid with default 4-column span', () => {
    const wrap = mount(IrisDashboardTemplate, {
      props: {
        cards: [
          { id: 'a', title: 'A' },
          { id: 'b', title: 'B' },
        ],
      },
    })
    const cards = wrap.findAll('[data-iris-dashboard-card-id]')
    expect(cards.length).toBe(2)
    expect(cards[0]!.text()).toContain('A')
  })

  it('default sidebar starts expanded; setting defaultCollapsed flips it', () => {
    const wrapOpen = mount(IrisDashboardTemplate, { props: {} })
    expect(wrapOpen.find('[data-iris-sidebar]').attributes('data-collapsed')).toBeUndefined()
    const wrapClosed = mount(IrisDashboardTemplate, {
      props: { defaultCollapsed: true },
    })
    expect(wrapClosed.find('[data-iris-sidebar]').attributes('data-collapsed')).toBe('')
  })
})
