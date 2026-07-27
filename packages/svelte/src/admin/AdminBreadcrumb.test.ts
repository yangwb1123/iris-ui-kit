import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import IrisAdminBreadcrumb from './AdminBreadcrumb.svelte'
import { __resetBreadcrumbStyles } from '../primitives/breadcrumb/styles'
import type { NavNode } from '@iris-ui-kit/core'

afterEach(() => {
  cleanup()
  __resetBreadcrumbStyles()
})

const trail: NavNode[] = [
  { key: 'sys', title: 'System', icon: 'folder' },
  { key: 'settings', title: 'Settings' },
  { key: 'profile', title: 'Profile' },
]

describe('@iris-ui-kit/svelte IrisAdminBreadcrumb', () => {
  it('renders a crumb per trail node + marks the last current', () => {
    const { container } = render(IrisAdminBreadcrumb, { props: { trail } })
    // Svelte uses CSS ::before separators (no separator elements) — assert crumbs.
    expect(container.querySelectorAll('[data-iris-admin-crumb]')).toHaveLength(3)
    expect(container.querySelector('[aria-current="page"]')).not.toBeNull()
  })

  it('calls onSelect for an ancestor crumb but not the current one', async () => {
    const onSelect = vi.fn()
    const { container } = render(IrisAdminBreadcrumb, { props: { trail, onSelect } })
    const crumbs = container.querySelectorAll<HTMLElement>('[data-iris-admin-crumb]')
    await fireEvent.click(crumbs[0]!) // System
    await fireEvent.click(crumbs[2]!) // Profile (current — no select)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('sys', trail[0])
  })

  it('renders nothing for an empty trail and respects hideSingle', () => {
    const { container: empty } = render(IrisAdminBreadcrumb, { props: { trail: [] } })
    expect(empty.querySelector('nav')).toBeNull()
    const { container: single } = render(IrisAdminBreadcrumb, {
      props: { trail: [trail[0]!], hideSingle: true },
    })
    expect(single.querySelector('nav')).toBeNull()
  })
})
